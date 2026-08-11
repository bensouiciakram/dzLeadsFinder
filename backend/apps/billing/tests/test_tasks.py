from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from django.db import connection
from django.db.models import Sum
from django.utils import timezone

import config.celery
from apps.billing.models import PaymentTransaction, Subscription
from apps.billing.pricing import _add_month
from apps.billing.tasks import (
    expire_failed_renewals,
    grant_credits,
    reconcile_pending_payments,
    resend_missing_receipts,
)
from apps.credits.models import CreditEventType, CreditLedger

pytestmark = pytest.mark.django_db

TASK_FULL_NAME = 'apps.billing.tasks.grant_credits'


class CaptureOnCommit:  # noqa: N801 — pytest-django lacks TestCase.captureOnCommitCallbacks
    """Capture ``transaction.on_commit`` callbacks (pytest-django rolls the
    test transaction back, so Django's TestCase captureOnCommitCallbacks is
    unavailable in function-style tests)."""

    def __enter__(self) -> 'CaptureOnCommit':
        self.callbacks: list[Any] = []
        self._orig = connection.on_commit
        connection.on_commit = self._capture
        return self

    def _capture(self, func: Any, robust: bool = False) -> None:
        self.callbacks.append((func, robust))

    def __exit__(self, *exc: Any) -> None:
        connection.on_commit = self._orig

    def execute(self) -> None:
        for callback, _robust in self.callbacks:
            callback()


def test_task_name_is_pinned_contract() -> None:
    assert grant_credits.name == TASK_FULL_NAME


def test_task_is_callable() -> None:
    assert callable(grant_credits)


def test_task_registered_in_celery_registry() -> None:
    registered = config.celery.app.tasks.get(TASK_FULL_NAME)
    assert registered is not None
    assert registered.name == TASK_FULL_NAME
    assert grant_credits.name == TASK_FULL_NAME


def test_task_retry_policy_matches_ad14() -> None:
    assert grant_credits.max_retries == 3
    assert grant_credits.autoretry_for == (Exception,)


def test_config_celery_explicitly_imports_billing_tasks() -> None:
    """Explicit import is MANDATORY — autodiscover_tasks() no-ops in this
    project (config/__init__ imports celery during django.setup, pre-registry;
    the email_tasks/maintenance_tasks precedent — 5.2 D18 amended). A rename
    or removal breaks worker task registration loudly.
    """
    source = Path(config.celery.__file__).read_text(encoding='utf-8')
    assert 'import apps.billing.tasks' in source


def test_webhooks_module_holds_no_task_definitions() -> None:
    """The webhook view module must not regain the task (5.2 RC-1 regression guard)."""
    webhooks_source = (
        Path(__file__).resolve().parent.parent / 'webhooks.py'
    ).read_text(encoding='utf-8')
    assert 'shared_task' not in webhooks_source


def test_missing_row_is_safe() -> None:
    grant_credits('no-such-event')
    assert PaymentTransaction.objects.count() == 0
    assert CreditLedger.objects.count() == 0


class TestGrantFlowPack:
    def test_pack_grant_75_credits_into_pack_pool(
        self, create_user: Any
    ) -> None:
        """FR-25: a 500 DZD pack grants 75 credits into the 'pack' pool,
        chained from in-transaction ledger SUMs (AD-4) — the tier is
        untouched (a free user stays free, 5.4 D4)."""
        row = PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_75',
            type='pack_purchase',
            amount_dzd=500,
        )
        grant_credits('evt_pack_75')

        entries = list(
            CreditLedger.objects.filter(user=create_user).order_by('created_at')
        )
        assert len(entries) == 1
        assert entries[0].event_type == 'pack_grant'
        assert entries[0].amount == 75
        assert entries[0].pool == 'pack'
        assert entries[0].balance_after == 75
        assert entries[0].reference_id == str(row.id)

        create_user.refresh_from_db()
        assert create_user.credits_balance == 75
        assert create_user.tier == 'free'

        row.refresh_from_db()
        assert row.status == 'succeeded'
        assert row.credits_granted == 75
        assert row.reconciled_at is not None

    def test_pack_grant_250_credits(self, create_user: Any) -> None:
        PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_250',
            type='pack_purchase',
            amount_dzd=1500,
        )
        grant_credits('evt_pack_250')
        entry = CreditLedger.objects.get(user=create_user)
        assert entry.amount == 250
        assert entry.pool == 'pack'
        row = PaymentTransaction.objects.get(chargily_event_id='evt_pack_250')
        assert row.status == 'succeeded'
        assert row.credits_granted == 250

    def test_pack_grant_leaves_subscription_pool_untouched(
        self, create_user: Any
    ) -> None:
        """The pack grant never touches the subscription pool (AD-7 — the
        pools are independent; drawdown order is the debit path's job)."""
        _grant(create_user, 200)
        PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_mix',
            type='pack_purchase',
            amount_dzd=500,
        )
        grant_credits('evt_pack_mix')
        pack_total = (
            CreditLedger.objects.filter(user=create_user, pool='pack').aggregate(
                total=Sum('amount')
            )['total']
        )
        assert pack_total == 75
        sub_total = (
            CreditLedger.objects.filter(
                user=create_user, pool='subscription'
            ).aggregate(total=Sum('amount'))['total']
        )
        assert sub_total == 200
        create_user.refresh_from_db()
        assert create_user.credits_balance == 275

    def test_pack_grant_does_not_downgrade_starter_tier(
        self, create_user: Any
    ) -> None:
        create_user.tier = 'starter'
        create_user.save(update_fields=['tier'])
        PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_starter',
            type='pack_purchase',
            amount_dzd=500,
        )
        grant_credits('evt_pack_starter')
        create_user.refresh_from_db()
        assert create_user.tier == 'starter'

    def test_pack_receipt_enqueued_on_commit(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_rcpt',
            type='pack_purchase',
            amount_dzd=1500,
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'tasks.email_tasks.send_pack_receipt',
            SimpleNamespace(delay=lambda txn_id: calls.append(txn_id)),
        )
        with CaptureOnCommit() as capture:
            grant_credits('evt_pack_rcpt')
        assert len(capture.callbacks) == 1
        capture.execute()
        assert len(calls) == 1
        row = PaymentTransaction.objects.get(chargily_event_id='evt_pack_rcpt')
        assert calls[0] == str(row.id)

    def test_off_table_amount_settles_failed_never_grants(
        self, create_user: Any, caplog: Any
    ) -> None:
        """D19 (Winston Q3): a pack amount the server table does not
        recognize is a corrupted/glitched charge — settle failed + alarm,
        NEVER grant (granting would fabricate a product and break
        ledger<->payment auditability)."""
        row = PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_bogus',
            type='pack_purchase',
            amount_dzd=499,
        )
        with caplog.at_level('ERROR'):
            grant_credits('evt_pack_bogus')
        row.refresh_from_db()
        assert row.status == 'failed'
        assert row.reconciled_at is not None
        assert CreditLedger.objects.count() == 0
        create_user.refresh_from_db()
        assert create_user.credits_balance == 0
        assert 'evt_pack_bogus' in caplog.text

    def test_pack_replay_is_noop(self, create_user: Any) -> None:
        PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_idem',
            type='pack_purchase',
            amount_dzd=500,
        )
        grant_credits('evt_pack_idem')
        grant_credits('evt_pack_idem')
        assert CreditLedger.objects.filter(user=create_user).count() == 1

    def test_anonymised_pack_row_settled_failed(self, caplog: Any) -> None:
        row = PaymentTransaction.objects.create(
            user=None,
            chargily_event_id='evt_pack_ghost',
            type='pack_purchase',
            amount_dzd=500,
        )
        with caplog.at_level('ERROR'):
            grant_credits('evt_pack_ghost')
        row.refresh_from_db()
        assert row.status == 'failed'
        assert CreditLedger.objects.count() == 0

    def test_off_table_subscription_amount_settles_failed(
        self, create_user: Any, caplog: Any
    ) -> None:
        """Review RP2: the subscription branch validates the stored amount at
        grant time (mirrors D19) — a tampered/glitched event must not
        fabricate 200 credits + starter tier from a mismatched charge."""
        row = _txn(create_user, 'evt_sub_bogus', amount=500)
        with caplog.at_level('ERROR'):
            grant_credits('evt_sub_bogus')
        row.refresh_from_db()
        assert row.status == 'failed'
        assert row.reconciled_at is not None
        assert CreditLedger.objects.count() == 0
        assert Subscription.objects.filter(user=create_user).count() == 0
        create_user.refresh_from_db()
        assert create_user.tier == 'free'

    def test_off_table_renewal_amount_settles_failed(
        self, create_user: Any, caplog: Any
    ) -> None:
        row = _txn(create_user, 'evt_renew_bogus', txn_type='subscription_renewal', amount=999)
        with caplog.at_level('ERROR'):
            grant_credits('evt_renew_bogus')
        row.refresh_from_db()
        assert row.status == 'failed'
        assert CreditLedger.objects.count() == 0

    def test_multi_pack_purchases_accumulate_and_chain(
        self, create_user: Any
    ) -> None:
        """Blind Hunter B10: two DISTINCT pack purchases each grant and the
        balance_after chains across them (75 -> 150)."""
        PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_a',
            type='pack_purchase',
            amount_dzd=500,
        )
        grant_credits('evt_pack_a')
        PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_b',
            type='pack_purchase',
            amount_dzd=500,
        )
        grant_credits('evt_pack_b')
        entries = list(
            CreditLedger.objects.filter(user=create_user, event_type='pack_grant')
            .order_by('created_at', 'pk')
        )
        assert [e.amount for e in entries] == [75, 75]
        assert entries[0].balance_after == 75
        assert entries[1].balance_after == 150
        create_user.refresh_from_db()
        assert create_user.credits_balance == 150

    def test_pack_grant_self_heals_stale_cache(self, create_user: Any) -> None:
        """Blind Hunter B10: the credits-only cache update recomputes from
        the ledger — a stale cache column must not poison it (AD-4)."""
        create_user.credits_balance = 999
        create_user.save(update_fields=['credits_balance'])
        PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_pack_cache',
            type='pack_purchase',
            amount_dzd=500,
        )
        grant_credits('evt_pack_cache')
        create_user.refresh_from_db()
        assert create_user.credits_balance == 75


def _txn(
    user: Any,
    event_id: str,
    txn_type: str = 'subscription_creation',
    amount: int = 1500,
    metadata: Any = None,
) -> Any:
    return PaymentTransaction.objects.create(
        user=user,
        chargily_event_id=event_id,
        type=txn_type,
        amount_dzd=amount,
        chargily_metadata=metadata,
    )


def _active_sub(user: Any, *, days_remaining: int = 20) -> Any:
    now = timezone.now()
    return Subscription.objects.create(
        user=user,
        status='active',
        current_period_start=now - timedelta(days=30 - days_remaining),
        current_period_end=now + timedelta(days=days_remaining),
    )


def _grant(user: Any, amount: int, pool: str = 'subscription') -> None:
    total = (
        CreditLedger.objects.filter(user_id=user.id).aggregate(
            total=Sum('amount')
        )['total']
        or 0
    )
    CreditLedger.objects.create(
        user=user,
        event_type=CreditEventType.SUBSCRIPTION_GRANT,
        amount=amount,
        balance_after=total + amount,
        pool=pool,
    )


class TestGrantFlowCreation:
    def test_creation_creates_subscription_and_grants(
        self, create_user: Any, caplog: Any
    ) -> None:
        _txn(create_user, 'evt_create_1')
        with caplog.at_level('INFO'):
            grant_credits('evt_create_1')

        sub = Subscription.objects.get(user=create_user)
        assert sub.status == 'active'
        assert abs((sub.current_period_start - timezone.now()).total_seconds()) < 5
        assert (
            abs((sub.current_period_end - _add_month(timezone.now())).total_seconds())
            < 5
        )
        entries = list(
            CreditLedger.objects.filter(user=create_user).order_by('created_at')
        )
        assert len(entries) == 1
        assert entries[0].event_type == 'subscription_grant'
        assert entries[0].amount == 200
        assert entries[0].pool == 'subscription'
        assert entries[0].balance_after == 200
        assert entries[0].reference_id is not None

        create_user.refresh_from_db()
        assert create_user.tier == 'starter'

        row = PaymentTransaction.objects.get(chargily_event_id='evt_create_1')
        assert row.status == 'succeeded'
        assert row.credits_granted == 200
        assert row.reconciled_at is not None

    def test_creation_enqueues_receipt_on_commit(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        _txn(create_user, 'evt_create_rcpt')
        calls: list[Any] = []
        monkeypatch.setattr(
            'tasks.email_tasks.send_payment_receipt',
            SimpleNamespace(delay=lambda txn_id: calls.append(txn_id)),
        )
        with CaptureOnCommit() as capture:
            grant_credits('evt_create_rcpt')
        assert len(capture.callbacks) == 1
        capture.execute()
        assert len(calls) == 1
        row = PaymentTransaction.objects.get(chargily_event_id='evt_create_rcpt')
        assert calls[0] == str(row.id)

    def test_creation_with_active_subscription_last_payment_wins(
        self, create_user: Any, caplog: Any
    ) -> None:
        """A distinct second PAID creation while ACTIVE: the LAST payment wins
        — the cycle is re-anchored to it and granted (no double-grant, no
        misleading 0-credit receipt — review P1, user decision 2026-08-10)."""
        sub = _active_sub(create_user)
        old_end = sub.current_period_end
        _grant(create_user, 200)
        _txn(create_user, 'evt_create_dup')
        with caplog.at_level('WARNING'):
            grant_credits('evt_create_dup')

        assert 'LAST payment wins' in caplog.text
        sub.refresh_from_db()
        assert sub.status == 'active'
        assert abs((sub.current_period_start - timezone.now()).total_seconds()) < 5
        assert (
            abs((sub.current_period_end - _add_month(timezone.now())).total_seconds())
            < 5
        )
        assert sub.current_period_end != old_end
        assert Subscription.objects.filter(user=create_user).count() == 1
        entries = list(
            CreditLedger.objects.filter(user=create_user).order_by('created_at')
        )
        assert [e.event_type for e in entries] == [
            'subscription_grant',
            'expiry',
            'subscription_grant',
        ]
        assert entries[2].amount == 200
        assert entries[2].balance_after == 200
        row = PaymentTransaction.objects.get(chargily_event_id='evt_create_dup')
        assert row.status == 'succeeded'
        assert row.credits_granted == 200

    def test_renewal_persists_chargily_subscription_id(
        self, create_user: Any
    ) -> None:
        """The webhook-shaped metadata subscription_id lands on the row
        (review P2 — the payment_failed fallback lookup key)."""
        sub = _active_sub(create_user)
        _grant(create_user, 200)
        row = _txn(create_user, 'evt_renew_sid', txn_type='subscription_renewal')
        row.chargily_metadata = {'subscription_id': 'sub_ch_77'}
        row.save(update_fields=['chargily_metadata'])

        grant_credits('evt_renew_sid')

        sub.refresh_from_db()
        assert sub.chargily_subscription_id == 'sub_ch_77'

    def test_user_deleted_mid_flight_settles_immediately(
        self, create_user: Any, caplog: Any
    ) -> None:
        """Review P5 (Blind Hunter B4): a user deleted between the webhook
        insert and the grant run settles the row instead of burning the
        AD-14 retries and looping the sweep forever."""
        row = _txn(create_user, 'evt_midflight')
        create_user.delete()
        with caplog.at_level('WARNING'):
            grant_credits('evt_midflight')
        row.refresh_from_db()
        assert row.status == 'failed'
        assert row.reconciled_at is not None
        assert CreditLedger.objects.count() == 0

    def test_creation_reactivates_failed_renewal_row(
        self, create_user: Any
    ) -> None:
        """Re-subscription re-activates the SAME row (John Q3) + full grant
        with the no-rollover reset (the old cycle ends now)."""
        now = timezone.now()
        existing = Subscription.objects.create(
            user=create_user,
            status='failed_renewal',
            current_period_start=now - timedelta(days=40),
            current_period_end=now + timedelta(days=5),
        )
        _grant(create_user, 200)
        _txn(create_user, 'evt_create_react')

        grant_credits('evt_create_react')

        existing.refresh_from_db()
        assert existing.status == 'active'
        assert abs((existing.current_period_start - now).total_seconds()) < 5
        assert abs((existing.current_period_end - _add_month(now)).total_seconds()) < 5
        entries = list(
            CreditLedger.objects.filter(user=create_user).order_by('created_at')
        )
        assert [e.event_type for e in entries] == [
            'subscription_grant',
            'expiry',
            'subscription_grant',
        ]
        assert entries[1].amount == -200
        assert entries[1].balance_after == 0
        assert entries[2].amount == 200
        assert entries[2].balance_after == 200
        assert Subscription.objects.filter(user=create_user).count() == 1

    def test_creation_reactivates_cancelled_row_and_clears_cancelled_at(
        self, create_user: Any
    ) -> None:
        """cancelled_at ⇒ cancelled is one-way — re-activation must clear it
        (subscriptions_cancel_state_check)."""
        now = timezone.now()
        existing = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=3),
            current_period_start=now - timedelta(days=40),
            current_period_end=now + timedelta(days=5),
        )
        _txn(create_user, 'evt_create_recancel')

        grant_credits('evt_create_recancel')

        existing.refresh_from_db()
        assert existing.status == 'active'
        assert existing.cancelled_at is None

    def test_reactivation_before_period_end_anchors_at_period_end(
        self, create_user: Any
    ) -> None:
        """Winston Q5 / John V3 — the AC's literal reading: Reactivate
        "resumes subscription from next billing date". A cancelled row
        re-activated BEFORE its (paid) period ends chains the new cycle at
        the old current_period_end — the billing date is preserved and the
        access promise is contiguous (no gap, no overlap)."""
        now = timezone.now()
        period_end = now + timedelta(days=9)
        existing = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=3),
            current_period_start=now - timedelta(days=21),
            current_period_end=period_end,
        )
        _txn(create_user, 'evt_create_anchor')

        grant_credits('evt_create_anchor')

        existing.refresh_from_db()
        assert existing.status == 'active'
        assert abs((existing.current_period_start - period_end).total_seconds()) < 5
        assert (
            abs((existing.current_period_end - _add_month(period_end)).total_seconds())
            < 5
        )

    def test_reactivation_after_period_end_anchors_now(
        self, create_user: Any
    ) -> None:
        """The cancelled period already ended (access elapsed) — max() falls
        through to now: a fresh cycle from the payment."""
        now = timezone.now()
        existing = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=40),
            current_period_start=now - timedelta(days=70),
            current_period_end=now - timedelta(days=10),
        )
        _txn(create_user, 'evt_create_anchor_late')

        grant_credits('evt_create_anchor_late')

        existing.refresh_from_db()
        assert existing.status == 'active'
        assert abs((existing.current_period_start - now).total_seconds()) < 5
        assert (
            abs((existing.current_period_end - _add_month(now)).total_seconds()) < 5
        )

    def test_failed_renewal_reactivation_stays_now_anchored(
        self, create_user: Any
    ) -> None:
        """Winston Q5 / John V3 — the deliberate asymmetry: failed_renewal
        re-pay stays now-anchored as shipped in 5.3 (a broken cycle
        restarts); only the cancelled branch preserves the billing date.
        Pins the 5.3 behavior against future 'fixes'."""
        now = timezone.now()
        existing = Subscription.objects.create(
            user=create_user,
            status='failed_renewal',
            current_period_start=now - timedelta(days=40),
            current_period_end=now + timedelta(days=5),
        )
        _grant(create_user, 200)
        _txn(create_user, 'evt_create_fr_anchor')

        grant_credits('evt_create_fr_anchor')

        existing.refresh_from_db()
        assert existing.status == 'active'
        assert abs((existing.current_period_start - now).total_seconds()) < 5
        assert abs((existing.current_period_end - _add_month(now)).total_seconds()) < 5

    def test_renewal_after_cancel_reactivates_orphan_row(
        self, create_user: Any, caplog: Any
    ) -> None:
        """Winston Q6 pin — the "no auto-renewal" AC means OUR system never
        renews without a paid event; a PAID subscription_renewal webhook
        arriving after cancellation is a new paid cycle and is honored
        (paid-event-never-skipped — the orphan path creates an ACTIVE row
        + grant + ERROR alarm). Settling would convert collected money into
        an unpaid outcome needing an ops refund."""
        now = timezone.now()
        cancelled = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=3),
            current_period_start=now - timedelta(days=40),
            current_period_end=now + timedelta(days=5),
        )
        _txn(create_user, 'evt_renew_after_cancel', txn_type='subscription_renewal')
        with caplog.at_level('ERROR'):
            grant_credits('evt_renew_after_cancel')

        assert 'orphan renewal' in caplog.text
        cancelled.refresh_from_db()
        assert cancelled.status == 'cancelled'
        assert cancelled.cancelled_at is not None
        created = Subscription.objects.get(
            user=create_user, status='active', cancelled_at__isnull=True
        )
        assert created.pk != cancelled.pk
        create_user.refresh_from_db()
        assert create_user.credits_balance == 200

    def test_orphan_renewal_skips_colliding_chargily_id(
        self, create_user: Any, caplog: Any
    ) -> None:
        """Review P4 — a cancelled row that still holds the Chargily
        subscription id (in-app cancel while Chargily keeps billing) would
        collide with subscriptions_chargily_id_uniq when the orphan
        persists the same id: the grant would retry-loop with the money
        stuck pending. The orphan persists the id only when no other row
        owns it — the grant still lands."""
        now = timezone.now()
        cancelled = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=3),
            current_period_start=now - timedelta(days=40),
            current_period_end=now + timedelta(days=5),
            chargily_subscription_id='sub-abc-123',
        )
        _txn(
            create_user,
            'evt_renew_collide',
            txn_type='subscription_renewal',
            metadata={'subscription_id': 'sub-abc-123'},
        )
        with caplog.at_level('ERROR'):
            grant_credits('evt_renew_collide')

        assert 'orphan renewal' in caplog.text
        created = Subscription.objects.get(
            user=create_user, status='active', cancelled_at__isnull=True
        )
        assert created.pk != cancelled.pk
        # The id stays owned by the cancelled row — no unique violation,
        # the grant landed.
        cancelled.refresh_from_db()
        assert cancelled.chargily_subscription_id == 'sub-abc-123'
        assert created.chargily_subscription_id is None
        create_user.refresh_from_db()
        assert create_user.credits_balance == 200


class TestGrantFlowRenewal:
    def test_renewal_extends_period_and_resets_pool(
        self, create_user: Any
    ) -> None:
        now = timezone.now()
        sub = _active_sub(create_user)
        _grant(create_user, 200)
        CreditLedger.objects.create(
            user=create_user,
            event_type='reveal_debit',
            amount=-5,
            balance_after=195,
            pool='subscription',
        )
        _txn(create_user, 'evt_renew_1', txn_type='subscription_renewal')

        grant_credits('evt_renew_1')

        sub.refresh_from_db()
        assert sub.status == 'active'
        anchor = now + timedelta(days=20)
        assert abs((sub.current_period_start - anchor).total_seconds()) < 5
        assert (
            abs((sub.current_period_end - _add_month(anchor)).total_seconds()) < 5
        )
        entries = list(
            CreditLedger.objects.filter(user=create_user).order_by('created_at')
        )
        assert [e.event_type for e in entries] == [
            'subscription_grant',
            'reveal_debit',
            'expiry',
            'subscription_grant',
        ]
        assert entries[2].amount == -195
        assert entries[2].balance_after == 0
        assert entries[3].amount == 200
        assert entries[3].balance_after == 200
        assert entries[3].pool == 'subscription'
        create_user.refresh_from_db()
        assert create_user.credits_balance == 200

    def test_renewal_keeps_pack_pool_untouched(self, create_user: Any) -> None:
        _active_sub(create_user)
        _grant(create_user, 200)
        _grant(create_user, 75, pool='pack')
        _txn(create_user, 'evt_renew_pack', txn_type='subscription_renewal')

        grant_credits('evt_renew_pack')

        pack_total = (
            CreditLedger.objects.filter(user=create_user, pool='pack').aggregate(
                total=Sum('amount')
            )['total']
        )
        assert pack_total == 75
        sub_total = (
            CreditLedger.objects.filter(
                user=create_user, pool='subscription'
            ).aggregate(total=Sum('amount'))['total']
        )
        assert sub_total == 200

    def test_late_renewal_anchors_from_now(self, create_user: Any) -> None:
        """The webhook arrives AFTER the period ended — anchor from now
        (max(previous end, now))."""
        now = timezone.now()
        sub = _active_sub(create_user, days_remaining=-3)
        _grant(create_user, 50)
        _txn(create_user, 'evt_renew_late', txn_type='subscription_renewal')

        grant_credits('evt_renew_late')

        sub.refresh_from_db()
        assert abs((sub.current_period_start - now).total_seconds()) < 5
        assert abs((sub.current_period_end - _add_month(now)).total_seconds()) < 5

    def test_orphan_renewal_creates_row_and_grants(
        self, create_user: Any, caplog: Any
    ) -> None:
        """Paid events are never silently skipped (Winston Q8)."""
        _txn(create_user, 'evt_renew_orphan', txn_type='subscription_renewal')
        with caplog.at_level('ERROR'):
            grant_credits('evt_renew_orphan')
        sub = Subscription.objects.get(user=create_user)
        assert sub.status == 'active'
        assert CreditLedger.objects.filter(
            user=create_user, event_type='subscription_grant'
        ).count() == 1


class TestGrantFlowIdempotency:
    def test_second_run_is_noop(self, create_user: Any) -> None:
        """The sweep double-enqueue case: the status check under the row lock
        makes the second run a no-op (5.3 D8)."""
        _txn(create_user, 'evt_idem_1')
        grant_credits('evt_idem_1')
        grant_credits('evt_idem_1')
        assert CreditLedger.objects.filter(user=create_user).count() == 1
        assert Subscription.objects.filter(user=create_user).count() == 1

    def test_anonymised_row_settled_failed(self, caplog: Any) -> None:
        """A paid-but-ungrantable row is settled, never left pending (5.3 D17)."""
        row = PaymentTransaction.objects.create(
            user=None,
            chargily_event_id='evt_ghost',
            type='subscription_creation',
            amount_dzd=1500,
        )
        with caplog.at_level('ERROR'):
            grant_credits('evt_ghost')
        row.refresh_from_db()
        assert row.status == 'failed'
        assert row.reconciled_at is not None
        assert CreditLedger.objects.count() == 0
        assert 'evt_ghost' in caplog.text


class TestReconcileSweep:
    SWEEP_FULL_NAME = 'apps.billing.tasks.reconcile_pending_payments'

    def test_task_name_is_pinned_contract(self) -> None:
        assert reconcile_pending_payments.name == self.SWEEP_FULL_NAME

    def test_registered_in_celery_registry(self) -> None:
        assert config.celery.app.tasks.get(self.SWEEP_FULL_NAME) is not None

    def test_beat_entry_registered(self) -> None:
        schedule = config.celery.app.conf.beat_schedule
        assert schedule['reconcile-pending-payments-hourly']['task'] == (
            self.SWEEP_FULL_NAME
        )

    def test_reenqueues_stale_pending_row(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        row = _txn(create_user, 'evt_sweep_1')
        PaymentTransaction.objects.filter(pk=row.pk).update(
            created_at=timezone.now() - timedelta(hours=1)
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'apps.billing.tasks.grant_credits',
            SimpleNamespace(delay=lambda event_id: calls.append(event_id)),
        )
        reconcile_pending_payments()
        assert calls == ['evt_sweep_1']

    def test_fresh_row_untouched(self, create_user: Any, monkeypatch: Any) -> None:
        _txn(create_user, 'evt_sweep_fresh')
        calls: list[Any] = []
        monkeypatch.setattr(
            'apps.billing.tasks.grant_credits',
            SimpleNamespace(delay=lambda event_id: calls.append(event_id)),
        )
        reconcile_pending_payments()
        assert calls == []

    def test_succeeded_rows_untouched(self, create_user: Any, monkeypatch: Any) -> None:
        row = _txn(create_user, 'evt_sweep_done')
        PaymentTransaction.objects.filter(pk=row.pk).update(
            status='succeeded',
            created_at=timezone.now() - timedelta(hours=1),
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'apps.billing.tasks.grant_credits',
            SimpleNamespace(delay=lambda event_id: calls.append(event_id)),
        )
        reconcile_pending_payments()
        assert calls == []

    def test_stale_null_user_row_settled(self, caplog: Any) -> None:
        row = PaymentTransaction.objects.create(
            user=None,
            chargily_event_id='evt_sweep_ghost',
            type='subscription_creation',
            amount_dzd=1500,
        )
        PaymentTransaction.objects.filter(pk=row.pk).update(
            created_at=timezone.now() - timedelta(hours=2)
        )
        with caplog.at_level('ERROR'):
            reconcile_pending_payments()
        row.refresh_from_db()
        assert row.status == 'failed'
        assert row.reconciled_at is not None
        assert 'evt_sweep_ghost' in caplog.text

    def test_pack_rows_are_re_enqueued_by_sweep(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        """5.4 D22: the 5.3 P6 exclusion dies — the 5.4 grant task CAN grant
        packs, so the sweep re-enqueues stale pack rows (they no longer
        churn: the grant task terminates them)."""
        row = PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_sweep_pack',
            type='pack_purchase',
            amount_dzd=500,
        )
        PaymentTransaction.objects.filter(pk=row.pk).update(
            created_at=timezone.now() - timedelta(hours=2)
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'apps.billing.tasks.grant_credits',
            SimpleNamespace(delay=lambda event_id: calls.append(event_id)),
        )
        reconcile_pending_payments()
        assert calls == ['evt_sweep_pack']


class TestResendMissingReceipts:
    RESEND_FULL_NAME = 'apps.billing.tasks.resend_missing_receipts'

    def test_task_name_is_pinned_contract(self) -> None:
        assert resend_missing_receipts.name == self.RESEND_FULL_NAME

    def test_registered_in_celery_registry(self) -> None:
        assert config.celery.app.tasks.get(self.RESEND_FULL_NAME) is not None

    def test_beat_entry_registered(self) -> None:
        schedule = config.celery.app.conf.beat_schedule
        assert schedule['resend-missing-receipts-hourly']['task'] == (
            self.RESEND_FULL_NAME
        )

    def test_task_retry_policy_covers_broker_outage(self) -> None:
        """RP6: the sweep itself retries (a total broker outage aborts the
        run mid-iteration; the receipt tasks' marker re-check makes the
        retry idempotent)."""
        assert resend_missing_receipts.max_retries == 3
        assert resend_missing_receipts.autoretry_for == (Exception,)

    def test_reenqueues_succeeded_row_without_marker(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        """5.4 D20: a succeeded row whose receipt never fired (broker-down at
        commit — 5.3 P7) is rescued by the sweep."""
        row = _txn(create_user, 'evt_rcpt_miss')
        PaymentTransaction.objects.filter(pk=row.pk).update(
            status='succeeded',
            credits_granted=200,
            created_at=timezone.now() - timedelta(hours=1),
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'tasks.email_tasks.send_payment_receipt',
            SimpleNamespace(delay=lambda txn_id: calls.append(txn_id)),
        )
        resend_missing_receipts()
        assert calls == [str(row.id)]

    def test_reenqueues_pack_row_to_pack_task(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        row = PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt_rcpt_pack_miss',
            type='pack_purchase',
            amount_dzd=500,
        )
        PaymentTransaction.objects.filter(pk=row.pk).update(
            status='succeeded',
            credits_granted=75,
            created_at=timezone.now() - timedelta(hours=1),
        )
        pack_calls: list[Any] = []
        sub_calls: list[Any] = []
        monkeypatch.setattr(
            'tasks.email_tasks.send_pack_receipt',
            SimpleNamespace(delay=lambda txn_id: pack_calls.append(txn_id)),
        )
        monkeypatch.setattr(
            'tasks.email_tasks.send_payment_receipt',
            SimpleNamespace(delay=lambda txn_id: sub_calls.append(txn_id)),
        )
        resend_missing_receipts()
        assert pack_calls == [str(row.id)]
        assert sub_calls == []

    def test_marked_row_untouched(self, create_user: Any, monkeypatch: Any) -> None:
        row = _txn(create_user, 'evt_rcpt_sent')
        PaymentTransaction.objects.filter(pk=row.pk).update(
            status='succeeded',
            credits_granted=200,
            receipt_sent_at=timezone.now() - timedelta(minutes=5),
            created_at=timezone.now() - timedelta(hours=1),
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'tasks.email_tasks.send_payment_receipt',
            SimpleNamespace(delay=lambda txn_id: calls.append(txn_id)),
        )
        resend_missing_receipts()
        assert calls == []

    def test_fresh_succeeded_row_untouched(self, create_user: Any, monkeypatch: Any) -> None:
        """The in-flight window: a receipt task still running (or enqueued
        seconds ago) must not be double-enqueued."""
        row = _txn(create_user, 'evt_rcpt_fresh')
        PaymentTransaction.objects.filter(pk=row.pk).update(
            status='succeeded',
            credits_granted=200,
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'tasks.email_tasks.send_payment_receipt',
            SimpleNamespace(delay=lambda txn_id: calls.append(txn_id)),
        )
        resend_missing_receipts()
        assert calls == []

    def test_pending_rows_untouched(self, create_user: Any, monkeypatch: Any) -> None:
        row = _txn(create_user, 'evt_rcpt_pending')
        PaymentTransaction.objects.filter(pk=row.pk).update(
            created_at=timezone.now() - timedelta(hours=2)
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'tasks.email_tasks.send_payment_receipt',
            SimpleNamespace(delay=lambda txn_id: calls.append(txn_id)),
        )
        resend_missing_receipts()
        assert calls == []
        row.refresh_from_db()
        assert row.status == 'pending'

    def test_row_without_credits_granted_untouched(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        """Edge Hunter E7: a succeeded row with NULL credits_granted (legacy
        or manual) must not be re-enqueued — its receipt would claim 0
        credits."""
        row = _txn(create_user, 'evt_rcpt_nocredits')
        PaymentTransaction.objects.filter(pk=row.pk).update(
            status='succeeded',
            credits_granted=None,
            created_at=timezone.now() - timedelta(hours=2),
        )
        calls: list[Any] = []
        monkeypatch.setattr(
            'tasks.email_tasks.send_payment_receipt',
            SimpleNamespace(delay=lambda txn_id: calls.append(txn_id)),
        )
        resend_missing_receipts()
        assert calls == []

    def test_continues_after_per_row_enqueue_failure(
        self, create_user: Any, monkeypatch: Any, caplog: Any
    ) -> None:
        """RP6: one failing enqueue must not abort the whole sweep — the
        remaining rows are still dispatched and the failure is logged."""
        row1 = _txn(create_user, 'evt_rcpt_fail1')
        PaymentTransaction.objects.filter(pk=row1.pk).update(
            status='succeeded',
            credits_granted=200,
            created_at=timezone.now() - timedelta(hours=2),
        )
        row2 = _txn(create_user, 'evt_rcpt_fail2')
        PaymentTransaction.objects.filter(pk=row2.pk).update(
            status='succeeded',
            credits_granted=200,
            created_at=timezone.now() - timedelta(hours=2),
        )
        calls: list[Any] = []

        class Flaky:
            def __init__(self, fail_first: int) -> None:
                self.fail_first = fail_first

            def delay(self, txn_id: Any) -> None:
                if self.fail_first > 0:
                    self.fail_first -= 1
                    raise RuntimeError('broker down')
                calls.append(txn_id)

        monkeypatch.setattr('tasks.email_tasks.send_payment_receipt', Flaky(1))
        with caplog.at_level('ERROR'):
            resend_missing_receipts()
        # Exactly one row fails (the Flaky first call) and the OTHER row is
        # still dispatched — the sweep continues past a per-row failure.
        # (Iteration order is newest-first — the Meta ordering — so the
        # assertion is order-agnostic.)
        assert len(calls) == 1
        failed_id = str(row1.id) if str(row1.id) in caplog.text else str(row2.id)
        succeeded_id = str(row2.id) if failed_id == str(row1.id) else str(row1.id)
        assert calls == [succeeded_id]


class TestExpireFailedRenewals:
    EXPIRE_FULL_NAME = 'apps.billing.tasks.expire_failed_renewals'

    def test_task_name_is_pinned_contract(self) -> None:
        assert expire_failed_renewals.name == self.EXPIRE_FULL_NAME

    def test_registered_in_celery_registry(self) -> None:
        assert config.celery.app.tasks.get(self.EXPIRE_FULL_NAME) is not None

    def test_beat_entry_registered(self) -> None:
        schedule = config.celery.app.conf.beat_schedule
        assert schedule['expire-failed-renewals-daily']['task'] == (
            self.EXPIRE_FULL_NAME
        )

    def test_expires_due_failed_renewal_and_zeroes_pool(
        self, create_user: Any
    ) -> None:
        now = timezone.now()
        sub = Subscription.objects.create(
            user=create_user,
            status='failed_renewal',
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        _grant(create_user, 200)
        CreditLedger.objects.create(
            user=create_user,
            event_type='reveal_debit',
            amount=-5,
            balance_after=195,
            pool='subscription',
        )
        expire_failed_renewals()
        sub.refresh_from_db()
        assert sub.status == 'expired'
        entries = list(
            CreditLedger.objects.filter(user=create_user).order_by('created_at')
        )
        assert [e.event_type for e in entries] == [
            'subscription_grant',
            'reveal_debit',
            'expiry',
        ]
        assert entries[2].amount == -195
        assert entries[2].balance_after == 0
        assert entries[2].reference_id == str(sub.id)
        create_user.refresh_from_db()
        assert create_user.credits_balance == 0

    def test_active_subscription_untouched(self, create_user: Any) -> None:
        _active_sub(create_user)
        expire_failed_renewals()
        sub = Subscription.objects.get(user=create_user)
        assert sub.status == 'active'

    def test_active_past_due_subscription_is_expired(
        self, create_user: Any
    ) -> None:
        """Review P4 (Edge Hunter E2): a renewal that never lands must not
        leave the user 409-blocked forever — active-past-due rows expire
        with the pool reset."""
        now = timezone.now()
        sub = Subscription.objects.create(
            user=create_user,
            status='active',
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        _grant(create_user, 200)
        expire_failed_renewals()
        sub.refresh_from_db()
        assert sub.status == 'expired'
        entries = list(
            CreditLedger.objects.filter(user=create_user).order_by('created_at')
        )
        assert [e.event_type for e in entries] == ['subscription_grant', 'expiry']
        assert entries[1].amount == -200
        assert entries[1].balance_after == 0
        create_user.refresh_from_db()
        assert create_user.credits_balance == 0

    def test_active_row_with_future_end_untouched(self, create_user: Any) -> None:
        _active_sub(create_user, days_remaining=20)
        expire_failed_renewals()
        sub = Subscription.objects.get(user=create_user)
        assert sub.status == 'active'

    def test_future_failed_renewal_untouched(self, create_user: Any) -> None:
        now = timezone.now()
        Subscription.objects.create(
            user=create_user,
            status='failed_renewal',
            current_period_start=now - timedelta(days=30),
            current_period_end=now + timedelta(days=5),
        )
        expire_failed_renewals()
        sub = Subscription.objects.get(user=create_user)
        assert sub.status == 'failed_renewal'

    def test_anonymised_failed_renewal_expires_without_ledger_write(self) -> None:
        now = timezone.now()
        Subscription.objects.create(
            user=None,
            status='failed_renewal',
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        expire_failed_renewals()
        sub = Subscription.objects.get()
        assert sub.status == 'expired'
        assert CreditLedger.objects.count() == 0

    def test_pack_pool_survives_expiry(self, create_user: Any) -> None:
        now = timezone.now()
        Subscription.objects.create(
            user=create_user,
            status='failed_renewal',
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        _grant(create_user, 200)
        _grant(create_user, 75, pool='pack')
        expire_failed_renewals()
        pack_total = (
            CreditLedger.objects.filter(user=create_user, pool='pack').aggregate(
                total=Sum('amount')
            )['total']
        )
        assert pack_total == 75

    # ---- 5.7: the cancelled-row post-period state machine (deferred-work
    # 5.5) + the tier-split-brain close (deferred-work 5.1 — "5.7 cancel
    # sync"). A cancelled row keeps Starter entitlement to period end (the
    # AC chip "access until {date}") and is expired by the same beat at
    # period end — pool zeroed (FR-24 no-rollover — John V4), user.tier
    # synced to 'free' (entitlement reads user.tier — search/quota.py).

    def test_cancelled_row_past_period_end_expires_zeroes_pool_and_syncs_tier(
        self, create_user: Any
    ) -> None:
        now = timezone.now()
        create_user.tier = 'starter'
        create_user.credits_balance = 200
        create_user.save(update_fields=['tier', 'credits_balance'])
        sub = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=10),
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        _grant(create_user, 200)
        CreditLedger.objects.create(
            user=create_user,
            event_type='reveal_debit',
            amount=-5,
            balance_after=195,
            pool='subscription',
        )
        expire_failed_renewals()
        sub.refresh_from_db()
        assert sub.status == 'expired'
        entries = list(
            CreditLedger.objects.filter(user=create_user).order_by('created_at')
        )
        assert [e.event_type for e in entries] == [
            'subscription_grant',
            'reveal_debit',
            'expiry',
        ]
        assert entries[2].amount == -195
        assert entries[2].balance_after == 0
        assert entries[2].reference_id == str(sub.id)
        create_user.refresh_from_db()
        assert create_user.credits_balance == 0
        assert create_user.tier == 'free'

    def test_cancelled_row_with_future_end_untouched(self, create_user: Any) -> None:
        now = timezone.now()
        create_user.tier = 'starter'
        create_user.save(update_fields=['tier'])
        Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now,
            current_period_start=now - timedelta(days=30),
            current_period_end=now + timedelta(days=5),
        )
        expire_failed_renewals()
        sub = Subscription.objects.get(user=create_user)
        assert sub.status == 'cancelled'
        create_user.refresh_from_db()
        assert create_user.tier == 'starter'

    def test_cancelled_expiry_does_not_touch_pack_pool(self, create_user: Any) -> None:
        now = timezone.now()
        Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=10),
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        _grant(create_user, 200)
        _grant(create_user, 150, pool='pack')
        expire_failed_renewals()
        pack_total = (
            CreditLedger.objects.filter(user=create_user, pool='pack').aggregate(
                total=Sum('amount')
            )['total']
        )
        assert pack_total == 150
        sub = Subscription.objects.get(user=create_user)
        assert sub.status == 'expired'

    def test_anonymised_cancelled_row_expires_without_ledger_or_tier_write(
        self,
    ) -> None:
        now = timezone.now()
        Subscription.objects.create(
            user=None,
            status='cancelled',
            cancelled_at=now - timedelta(days=10),
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        expire_failed_renewals()
        sub = Subscription.objects.get()
        assert sub.status == 'expired'
        assert CreditLedger.objects.count() == 0

    def test_tier_not_downgraded_when_another_active_row_exists(
        self, create_user: Any
    ) -> None:
        """The orphan-renewal anomaly (5.5 P4/5.3 Q8): a user can hold a
        cancelled row AND an active row. The expiry must not write
        tier='free' on a genuinely active subscriber."""
        now = timezone.now()
        create_user.tier = 'starter'
        create_user.save(update_fields=['tier'])
        cancelled = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=10),
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        active = Subscription.objects.create(
            user=create_user,
            status='active',
            current_period_start=now - timedelta(days=10),
            current_period_end=now + timedelta(days=20),
        )
        expire_failed_renewals()
        cancelled.refresh_from_db()
        assert cancelled.status == 'expired'
        active.refresh_from_db()
        assert active.status == 'active'
        create_user.refresh_from_db()
        assert create_user.tier == 'starter'

    def test_stale_due_snapshot_cannot_expire_a_reactivated_row(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        """Winston Q3 race pin: the due predicate is evaluated BEFORE any
        lock. If a paid grant re-anchors the row (status → active, period
        end → future) between the due-SELECT and the expiry's lock
        acquisition, the in-lock re-check must re-apply the FULL due
        predicate (status AND period end) — otherwise the beat would expire
        AND downgrade a freshly re-activated PAID row (the split-brain
        reopened silently)."""
        now = timezone.now()
        create_user.tier = 'starter'
        create_user.credits_balance = 200
        create_user.save(update_fields=['tier', 'credits_balance'])
        sub = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=10),
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        _grant(create_user, 200)
        # The due-SELECT snapshot (the row as it was at query time).
        stale = Subscription.objects.get(pk=sub.pk)
        # The grant commits BEFORE the expiry acquires its locks.
        sub.status = 'active'
        sub.cancelled_at = None
        sub.current_period_end = now + timedelta(days=30)
        sub.save(
            update_fields=['status', 'cancelled_at', 'current_period_end']
        )

        class StaleDueQuerySet:
            def iterator(self) -> Any:
                yield stale

        real_filter = Subscription.objects.filter

        def fake_filter(*args: Any, **kwargs: Any) -> Any:
            if 'status__in' in kwargs:
                return StaleDueQuerySet()
            return real_filter(*args, **kwargs)

        monkeypatch.setattr(Subscription.objects, 'filter', fake_filter)
        expire_failed_renewals()
        sub.refresh_from_db()
        assert sub.status == 'active'
        create_user.refresh_from_db()
        assert create_user.tier == 'starter'
        assert create_user.credits_balance == 200
        # The pool was NOT zeroed (no expiry entry).
        assert CreditLedger.objects.filter(event_type='expiry').count() == 0

    def test_cancelled_expiry_is_idempotent_on_rerun(self, create_user: Any) -> None:
        now = timezone.now()
        sub = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now - timedelta(days=10),
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        _grant(create_user, 200)
        expire_failed_renewals()
        expire_failed_renewals()
        sub.refresh_from_db()
        assert sub.status == 'expired'
        assert (
            CreditLedger.objects.filter(
                user=create_user, event_type='expiry'
            ).count()
            == 1
        )

    def test_active_past_due_expiry_syncs_tier_to_free(self, create_user: Any) -> None:
        """Review P2 (5.7 full review): on the active-due path (P4(a) — a
        renewal that never lands, status still 'active') the tier guard
        must NOT self-match the row being expired — an expired subscription
        must not keep Starter quota. The guard excludes the locked row."""
        now = timezone.now()
        create_user.tier = 'starter'
        create_user.credits_balance = 200
        create_user.save(update_fields=['tier', 'credits_balance'])
        sub = Subscription.objects.create(
            user=create_user,
            status='active',
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=1),
        )
        _grant(create_user, 200)
        expire_failed_renewals()
        sub.refresh_from_db()
        assert sub.status == 'expired'
        create_user.refresh_from_db()
        assert create_user.tier == 'free'
        assert create_user.credits_balance == 0
