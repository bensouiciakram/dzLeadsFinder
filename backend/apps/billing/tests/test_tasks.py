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


def test_pack_purchase_row_skipped_until_54(
    create_user: Any, caplog: Any
) -> None:
    """Pack grants are 5.4's deliverable — the row stays pending (5.3 D16)."""
    row = PaymentTransaction.objects.create(
        user=create_user,
        chargily_event_id='evt_pack_1',
        type='pack_purchase',
        amount_dzd=500,
    )
    with caplog.at_level('INFO'):
        grant_credits('evt_pack_1')
    row.refresh_from_db()
    assert row.status == 'pending'
    assert row.credits_granted is None
    assert CreditLedger.objects.count() == 0
    assert 'evt_pack_1' in caplog.text


def _txn(
    user: Any,
    event_id: str,
    txn_type: str = 'subscription_creation',
    amount: int = 1500,
) -> Any:
    return PaymentTransaction.objects.create(
        user=user,
        chargily_event_id=event_id,
        type=txn_type,
        amount_dzd=amount,
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

    def test_pack_rows_excluded_from_sweep(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        """Review P6 (Edge Hunter E5): 5.3's task can't grant packs (5.4
        owns them) — the sweep must not churn them hourly."""
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
        assert calls == []
        row.refresh_from_db()
        assert row.status == 'pending'


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
