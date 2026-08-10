"""Celery tasks for the billing app (5.2 RC-1 relocation, 2026-08-09).

The spine contradicts itself on task placement: L532 assigns "Webhook
handler + Celery tasks" to webhooks.py while L540 lists
``tasks/billing_tasks.py``. Resolved toward the repo's tasks convention:
the task lives in ``apps/billing/tasks.py`` and is registered via the
EXPLICIT ``import apps.billing.tasks`` in config/celery.py.

NOTE (5.2 D18 amended, 2026-08-09): ``app.autodiscover_tasks()`` does NOT
reliably register app tasks in this project — ``config/__init__.py`` imports
the celery app during ``django.setup()`` (before the app registry is ready),
so autodiscovery no-ops. That is exactly why ``tasks/email_tasks.py`` and
``tasks/maintenance_tasks.py`` are explicitly imported. The explicit import
is mandatory; do not remove it (tested by
``test_config_celery_explicitly_imports_billing_tasks``).

Module-level imports are limited to stdlib + ``celery`` — the module is
imported by Celery before the app registry is ready (the
``tasks/email_tasks.py`` precedent, 5.2 D9). All Django model/settings reads
are deferred to runtime.

Task full name pinned as a contract: ``apps.billing.tasks.grant_credits``
(5.2 D18). 5.3 replaces the bridge body with the real grant flow (5.3 D1).
"""

import logging
from typing import Any

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(  # type: ignore[misc]
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True,
)
def grant_credits(event_id: str) -> None:
    """Reconcile a paid Chargily event (5.3 — the real grant flow).

    Idempotency (5.3 D8): the txn row is ``select_for_update``-locked and
    the status check happens UNDER the lock — a second run (webhook retry,
    the pending-reconciliation sweep) sees ``succeeded`` and no-ops. The
    user row is also locked so grants serialize against concurrent reveals
    and expiries (the credits ``select_for_update`` precedent).

    NO SERIALIZABLE guard here (5.3 D8 deviation, recorded): the guard
    breaks under pytest-django's per-test atomic wrapper on the PG CI job
    (5.1 D13 — the 51 excluded credits/export tests); the row locks carry
    correctness on any isolation level and the concurrency proof is the
    Phase 5 E2E-race on real PG16.

    Write order (5.1 deferred-work "credits/status coupling", pinned here):
    INSERT pending (webhook) → grant → succeeded, all in the task's
    transaction. ``pack_purchase`` rows are skipped (5.4 owns pack grants)
    and stay pending.
    """
    from django.contrib.auth import get_user_model
    from django.db import transaction
    from django.utils import timezone

    from apps.billing.models import PaymentTransaction

    now = timezone.now()
    with transaction.atomic():
        try:
            row = PaymentTransaction.objects.select_for_update().get(
                chargily_event_id=event_id
            )
        except PaymentTransaction.DoesNotExist:
            logger.warning('grant_credits: no transaction row for event_id=%s', event_id)
            return
        if row.status != 'pending':
            logger.info(
                'grant_credits: event_id=%s already %s — no-op',
                event_id,
                row.status,
            )
            return
        if row.user_id is None:
            _settle_ungrantable(row, now, 'anonymised user (5.1 D2)')
            return

        try:
            user = get_user_model().objects.select_for_update().get(pk=row.user_id)
        except get_user_model().DoesNotExist:
            # The user was deleted between the webhook insert and this run —
            # SET_NULL will null the FK at the delete's commit, but the row
            # lock was taken before it. Settle immediately instead of burning
            # the 3 AD-14 retries and leaving the sweep to loop forever
            # (review P5 — Blind Hunter B4).
            logger.warning(
                'grant_credits: user %s for event %s deleted mid-flight — '
                'settling as failed',
                row.user_id,
                event_id,
            )
            _settle_ungrantable(row, now, 'user deleted mid-flight (P5)')
            return
        if row.type == 'pack_purchase':
            logger.info(
                'grant_credits: event_id=%s type=pack_purchase — '
                'pack grants land in 5.4 (row stays pending)',
                event_id,
            )
            return

        if row.type == 'subscription_creation':
            granted = _grant_creation(user, row, now)
        elif row.type == 'subscription_renewal':
            granted = _grant_renewal(user, row, now)
        else:
            logger.error(
                'grant_credits: event_id=%s unknown type=%r — settled as failed',
                event_id,
                row.type,
            )
            _settle_ungrantable(row, now, f'unknown type {row.type!r}')
            return

        row.status = 'succeeded'
        row.credits_granted = granted
        row.reconciled_at = now
        row.save(update_fields=['status', 'credits_granted', 'reconciled_at'])

        def _enqueue_receipt(txn_id: str) -> None:
            from tasks.email_tasks import send_payment_receipt

            try:
                send_payment_receipt.delay(txn_id)
            except Exception:
                # Broker down AT COMMIT TIME: the callback raised after the
                # txn committed — the task's autoretry re-run early-returns on
                # the status check, so the receipt can never be re-fired by
                # this path. Log loudly (review P7); a receipt-resend sweep
                # for succeeded-no-receipt rows is a 5.4+ deliverable.
                logger.error(
                    'grant_credits: receipt enqueue FAILED for txn %s — '
                    'the receipt will not be retried automatically',
                    txn_id,
                )

        # on_commit ONLY (5.3 D13): an inline delay() after commit would be
        # lost on the task's autoretry re-run — the status check early-returns
        # and the receipt would never fire.
        transaction.on_commit(lambda: _enqueue_receipt(str(row.id)))


def _settle_ungrantable(row: Any, now: Any, reason: str) -> None:
    """A paid-but-ungrantable row is settled, never left pending (5.3 D17).

    ``status='failed'`` + ERROR log carries the event id so ops (the admin
    surface) can refund/reconcile a row that was charged but could not be
    granted (anonymised user, unknown type).
    """
    row.status = 'failed'
    row.reconciled_at = now
    row.save(update_fields=['status', 'reconciled_at'])
    logger.error(
        'grant_credits: event_id=%s UNGRANTABLE (%s) — settled as failed',
        row.chargily_event_id,
        reason,
    )


def _ledger_totals(user_id: Any) -> tuple[int, int]:
    from django.db.models import Q, Sum

    from apps.credits.models import CreditLedger

    row = CreditLedger.objects.filter(user_id=user_id).aggregate(
        total=Sum('amount'),
        subscription=Sum('amount', filter=Q(pool='subscription')),
    )
    return row['total'] or 0, row['subscription'] or 0


def _grant_cycle(user: Any, reference_id: str, now: Any, *, reset_pool: bool) -> int:
    """Ledger writes + cache update for one grant cycle (5.3 D6).

    No-rollover (FR-24): when ``reset_pool`` (renewal, or re-activation of a
    failed_renewal row — the old cycle ends now), the remaining
    subscription-pool balance is zeroed via an ``expiry`` entry BEFORE the
    fresh grant, both in the same transaction. ``balance_after`` chains from
    in-transaction ledger SUMs (AD-4 — never ``user.credits_balance``); both
    rows carry ``reference_id`` = the payment txn id for audit correlation.
    The pack pool is never touched (FR-25 drawdown order — AD-7).
    """
    from apps.billing.pricing import SUBSCRIPTION_CREDITS
    from apps.credits.models import CreditEventType, CreditLedger, CreditPool

    total, subscription = _ledger_totals(user.id)
    if reset_pool and subscription > 0:
        CreditLedger.objects.create(
            user_id=user.id,
            event_type=CreditEventType.EXPIRY,
            amount=-subscription,
            balance_after=total - subscription,
            pool=CreditPool.SUBSCRIPTION,
            reference_id=reference_id,
            description='Cycle rollover — unused credits do not roll over (FR-24)',
        )
        total -= subscription
    CreditLedger.objects.create(
        user_id=user.id,
        event_type=CreditEventType.SUBSCRIPTION_GRANT,
        amount=SUBSCRIPTION_CREDITS,
        balance_after=total + SUBSCRIPTION_CREDITS,
        pool=CreditPool.SUBSCRIPTION,
        reference_id=reference_id,
        description='Starter monthly credits',
    )
    _update_user_cache(user, total + SUBSCRIPTION_CREDITS)
    return SUBSCRIPTION_CREDITS


def _update_user_cache(user: Any, final_ledger_total: int) -> None:
    """The credits_balance cache tracks the ledger (AD-4).

    The value is recomputed from the in-transaction ledger total (never a
    delta on the possibly-stale cached value) — the cache self-heals even if
    it lagged the ledger. The user row is select_for_update-locked by the
    caller. The tier write (5.3 — the deferred-work split-brain owner) is
    atomic with the grant.
    """
    user.credits_balance = final_ledger_total
    user.tier = 'starter'
    user.save(update_fields=['credits_balance', 'tier'])


def _latest_subscription(user: Any) -> Any:
    from apps.billing.models import Subscription

    return (
        Subscription.objects.filter(user_id=user.id)
        .order_by('-created_at')
        .first()
    )


def _persist_chargily_subscription_id(sub: Any, row: Any) -> None:
    """Persist the Chargily subscription id carried by the webhook payload.

    The 5.2-shaped ``chargily_metadata`` now stores ``subscription_id`` (5.3
    review P2). Persisting it on the subscription row gives the
    ``subscription.payment_failed`` handler a subscription-keyed lookup —
    the recovery key when metadata.user_id is absent (Blind Hunter B2/B5).
    """
    metadata = row.chargily_metadata
    subscription_id = (
        metadata.get('subscription_id') if isinstance(metadata, dict) else None
    )
    if not isinstance(subscription_id, str) or not subscription_id.strip():
        return
    if sub.chargily_subscription_id == subscription_id:
        return
    sub.chargily_subscription_id = subscription_id
    sub.save(update_fields=['chargily_subscription_id'])


def _grant_creation(user: Any, row: Any, now: Any) -> int:
    """subscription_creation: create or re-activate, then grant (5.3 D4).

    A distinct second PAID creation while an ACTIVE subscription exists is a
    genuine double-payment (the create-checkout 409 can't close the window
    before the first grant commits). User decision 2026-08-10 (review P1):
    the LAST payment wins — the active row is re-anchored to this payment
    (period from now) and the fresh cycle is granted with the no-rollover
    reset. The earlier cycle's balance is consumed by the reset, so no
    double-grant ever materializes and no payment is left un-granted.
    Same-event replays never reach here (webhook ON CONFLICT guard + the
    txn status check under the row lock).
    """
    from apps.billing.models import Subscription
    from apps.billing.pricing import _add_month

    latest = _latest_subscription(user)
    if latest is not None and latest.status == 'active':
        logger.warning(
            'grant_credits: creation event %s for user %s arrives while an '
            'ACTIVE subscription exists — the LAST payment wins: re-anchoring '
            'the cycle to this payment (no double-grant, 5.3 P1)',
            row.chargily_event_id,
            user.id,
        )
        latest.current_period_start = now
        latest.current_period_end = _add_month(now)
        latest.save(
            update_fields=['current_period_start', 'current_period_end']
        )
        _persist_chargily_subscription_id(latest, row)
        return _grant_cycle(user, str(row.id), now, reset_pool=True)

    if latest is not None:
        # Re-activate the SAME row (failed_renewal/cancelled/expired — FR-24
        # blocks only ACTIVE). cancelled_at ⇒ cancelled is one-way, so the
        # re-activation clears it (subscriptions_cancel_state_check).
        latest.status = 'active'
        latest.cancelled_at = None
        latest.current_period_start = now
        latest.current_period_end = _add_month(now)
        latest.save(
            update_fields=[
                'status', 'cancelled_at', 'current_period_start', 'current_period_end',
            ]
        )
        _persist_chargily_subscription_id(latest, row)
        reset_pool = True
    else:
        created = Subscription.objects.create(
            user_id=user.id,
            status='active',
            current_period_start=now,
            current_period_end=_add_month(now),
        )
        _persist_chargily_subscription_id(created, row)
        reset_pool = False

    return _grant_cycle(user, str(row.id), now, reset_pool=reset_pool)


def _grant_renewal(user: Any, row: Any, now: Any) -> int:
    """subscription_renewal: extend the period (anchor-preserving) + grant."""
    from apps.billing.models import Subscription
    from apps.billing.pricing import _add_month

    latest = _latest_subscription(user)
    if latest is None or latest.status not in ('active', 'failed_renewal'):
        # Orphan renewal (Winston Q8): the money was collected — a paid event
        # is never silently skipped; create the row and alarm.
        logger.error(
            'grant_credits: renewal event %s for user %s has no active/'
            'failed_renewal subscription — creating one (orphan renewal)',
            row.chargily_event_id,
            user.id,
        )
        created = Subscription.objects.create(
            user_id=user.id,
            status='active',
            current_period_start=now,
            current_period_end=_add_month(now),
        )
        _persist_chargily_subscription_id(created, row)
        return _grant_cycle(user, str(row.id), now, reset_pool=True)

    # Anchor preservation (5.3 D7): extend from max(previous end, now) — a
    # late webhook starts the new cycle now, an on-time one chains cleanly.
    anchor = max(latest.current_period_end, now)
    latest.status = 'active'
    latest.current_period_start = anchor
    latest.current_period_end = _add_month(anchor)
    latest.save(
        update_fields=['status', 'current_period_start', 'current_period_end']
    )
    _persist_chargily_subscription_id(latest, row)
    return _grant_cycle(user, str(row.id), now, reset_pool=True)


@shared_task  # type: ignore[misc]
def reconcile_pending_payments() -> None:
    """Recover the D15 window: enqueue failure after the webhook insert.

    The webhook inserts the row and enqueues grant_credits; if ``delay()``
    raises (Redis down), Chargily retries and the duplicate path acks 200
    WITHOUT re-enqueueing — the grant would never fire. This sweep
    re-enqueues stale ``pending`` rows (5.3 D10). NULL-user rows are
    settled here too (D17) — a row the task never ran must not poison the
    sweep. The 30-minute threshold ≫ the 5s webhook + AD-14 3-retry window,
    so fresh rows are never double-processed (and the grant's own lock +
    status check is the authoritative idempotency guard anyway).
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.billing.models import PaymentTransaction

    cutoff = timezone.now() - timedelta(minutes=30)
    # Pack rows are EXCLUDED (review P6): 5.3's grant task can't grant them
    # (5.4 owns pack semantics), so re-enqueueing them hourly is unbounded
    # churn (Edge Hunter E5). They wait in 'pending' for 5.4.
    stale = PaymentTransaction.objects.filter(
        status='pending',
        created_at__lt=cutoff,
        type__in=('subscription_creation', 'subscription_renewal'),
    )
    for row in stale.iterator():
        if row.user_id is None:
            _settle_ungrantable(
                row, timezone.now(), 'anonymised user (sweep backstop — 5.3 D10)'
            )
            continue
        grant_credits.delay(row.chargily_event_id)


@shared_task  # type: ignore[misc]
def expire_failed_renewals() -> None:
    """The failed-renewal exit path (5.3 D11; Sally 5.1 note).

    A failed renewal keeps the previous cycle's credits usable until the
    next cycle would have begun (FR-28). At ``current_period_end`` this task
    expires the remaining subscription-pool balance (``expiry`` ledger entry
    — the CreditEventType exists for exactly this) and transitions the
    subscription to ``expired``. Retry (a new ``subscription_creation``)
    re-activates the same row before this task runs; after expiry the user
    re-subscribes from scratch.

    Review P4 (2026-08-10): (a) ACTIVE-past-due rows are also expired — a
    renewal that never happens (no card retry, no payment_failed event) must
    not leave the user permanently 409-blocked from re-subscribing (Edge
    Hunter E2); (b) the USER row is locked FIRST (grant/reveal order), then
    the subscription row re-locked + status re-checked — no ABBA cycle with
    the grant task and no lost cache update vs concurrent reveals (Blind
    Hunter B3). The daily beat re-scans, so a transient failure self-heals.
    """
    from django.contrib.auth import get_user_model
    from django.db import transaction
    from django.utils import timezone

    from apps.billing.models import Subscription
    from apps.credits.models import CreditEventType, CreditLedger, CreditPool

    now = timezone.now()
    due = Subscription.objects.filter(
        status__in=('active', 'failed_renewal'),
        current_period_end__lte=now,
    )
    user_model = get_user_model()
    for sub in due.iterator():
        with transaction.atomic():
            if sub.user_id is not None:
                # Lock order user → subscription (review P4 — no ABBA cycle
                # with the grant task, which locks user → sub). The lock also
                # serializes the ledger read + cache write against concurrent
                # reveals/grants (no lost update).
                try:
                    user_model.objects.select_for_update().get(pk=sub.user_id)
                except user_model.DoesNotExist:
                    pass
            locked = Subscription.objects.select_for_update().get(pk=sub.pk)
            if locked.status not in ('active', 'failed_renewal'):
                continue
            if locked.user_id is not None:
                total, subscription = _ledger_totals(locked.user_id)
                if subscription > 0:
                    CreditLedger.objects.create(
                        user_id=locked.user_id,
                        event_type=CreditEventType.EXPIRY,
                        amount=-subscription,
                        balance_after=total - subscription,
                        pool=CreditPool.SUBSCRIPTION,
                        reference_id=str(locked.id),
                        description='Subscription expired — renewal did not land',
                    )
                    user_model.objects.filter(pk=locked.user_id).update(
                        credits_balance=total - subscription
                    )
            locked.status = 'expired'
            locked.save(update_fields=['status'])
            logger.info(
                'expire_failed_renewals: subscription %s expired (user %s)',
                locked.id,
                locked.user_id,
            )
