"""POST /api/billing/cancel/ — the Danger Zone's cancel flow (5.5).

Contract (Winston Q3 / John V2, 2026-08-10):
- ACTIVE subscription → 200 ``{status: 'cancelled', cancelled_at: ISO}``;
  ``cancelled_at`` = now, written with the status flip (the
  ``subscriptions_cancel_state_check`` constraint demands cancelled_at iff
  status = 'cancelled').
- Already-cancelled row → idempotent 200 (John V2: the intent is already
  satisfied — a double-click or post-refresh re-fire must not error).
- failed_renewal / expired → 409 ``code='subscription_not_active'`` (John
  V2: exit paths are re-pay or auto-expire; the 5.7 banner owns that
  messaging). No row at all → 409 ``code='subscription_not_found'``.
- Lock discipline (Winston Q3): user row locked FIRST, then the
  subscription row, status re-checked UNDER the sub lock (the grant D8
  discipline) — same relative order as the grant and expiry tasks (no ABBA
  cycle).
- user.tier is NOT touched (5.7 owns the tier-split-brain cancel sync —
  the Plan Card reads the subscription status, never user.tier).
- No Chargily call (the pinned envelope has no cancel surface; renewals
  arrive as paid webhook events — the AC's "no auto-renewal" is a
  local-state guarantee).
"""

from typing import Any

import pytest
from django.utils import timezone

from apps.billing.models import Subscription

pytestmark = pytest.mark.django_db


def _active_sub(user: Any, *, days_remaining: int = 20) -> Any:
    now = timezone.now()
    return Subscription.objects.create(
        user=user,
        status='active',
        current_period_start=now - timezone.timedelta(days=30 - days_remaining),
        current_period_end=now + timezone.timedelta(days=days_remaining),
    )


class TestCancelView:
    def test_requires_authentication(self, api_client: Any) -> None:
        response = api_client.post('/api/billing/cancel/')
        assert response.status_code == 401

    def test_active_subscription_cancelled(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        sub = _active_sub(create_user)
        response = logged_in_client.post('/api/billing/cancel/')
        assert response.status_code == 200
        assert response.data['status'] == 'cancelled'
        assert 'cancelled_at' in response.data
        sub.refresh_from_db()
        assert sub.status == 'cancelled'
        assert sub.cancelled_at is not None

    def test_access_continues_until_period_end(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """The AC: cancellation never shortens the paid period."""
        sub = _active_sub(create_user, days_remaining=12)
        logged_in_client.post('/api/billing/cancel/')
        sub.refresh_from_db()
        assert sub.current_period_end > timezone.now()
        assert (sub.current_period_end - timezone.now()).days <= 12

    def test_cancel_does_not_touch_user_tier(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """5.7 owns the tier-split-brain cancel sync — the Plan Card reads
        the subscription status, never user.tier (5.5 D8)."""
        _active_sub(create_user)
        create_user.tier = 'starter'
        create_user.save(update_fields=['tier'])
        response = logged_in_client.post('/api/billing/cancel/')
        assert response.status_code == 200
        create_user.refresh_from_db()
        assert create_user.tier == 'starter'

    def test_already_cancelled_is_idempotent(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        now = timezone.now()
        Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now,
            current_period_start=now - timezone.timedelta(days=30),
            current_period_end=now + timezone.timedelta(days=5),
        )
        first = logged_in_client.post('/api/billing/cancel/')
        second = logged_in_client.post('/api/billing/cancel/')
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.data['status'] == 'cancelled'

    def test_cancelled_row_with_null_cancelled_at_is_healed(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """The constraint is one-directional — a cancelled row with NULL
        cancelled_at is legal (legacy/manual data). The idempotent branch
        must heal it under the lock, never 500 (review P3)."""
        now = timezone.now()
        sub = Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=None,
            current_period_start=now - timezone.timedelta(days=30),
            current_period_end=now + timezone.timedelta(days=5),
        )
        response = logged_in_client.post('/api/billing/cancel/')
        assert response.status_code == 200
        assert response.data['status'] == 'cancelled'
        assert response.data['cancelled_at'] is not None
        sub.refresh_from_db()
        assert sub.cancelled_at is not None

    def test_failed_renewal_not_cancellable(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        now = timezone.now()
        Subscription.objects.create(
            user=create_user,
            status='failed_renewal',
            current_period_start=now - timezone.timedelta(days=40),
            current_period_end=now + timezone.timedelta(days=5),
        )
        response = logged_in_client.post('/api/billing/cancel/')
        assert response.status_code == 409
        assert response.data['code'] == 'subscription_not_active'

    def test_expired_not_cancellable(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        now = timezone.now()
        Subscription.objects.create(
            user=create_user,
            status='expired',
            current_period_start=now - timezone.timedelta(days=70),
            current_period_end=now - timezone.timedelta(days=40),
        )
        response = logged_in_client.post('/api/billing/cancel/')
        assert response.status_code == 409
        assert response.data['code'] == 'subscription_not_active'

    def test_no_subscription_not_found(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        response = logged_in_client.post('/api/billing/cancel/')
        assert response.status_code == 409
        assert response.data['code'] == 'subscription_not_found'

    def test_cancel_writes_no_ledger_row(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """Cancellation is a state flip only — no ledger, no cache, no
        renewal (the AC's no-auto-renewal guarantee)."""
        from apps.credits.models import CreditLedger

        _active_sub(create_user)
        before = CreditLedger.objects.filter(user=create_user).count()
        logged_in_client.post('/api/billing/cancel/')
        assert CreditLedger.objects.filter(user=create_user).count() == before

    def test_cancel_selects_the_latest_row(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """A dead expired row + a live active row → the active one cancels
        (the -created_at,-id latest-row discipline, plan-view precedent)."""
        now = timezone.now()
        expired = Subscription.objects.create(
            user=create_user,
            status='expired',
            current_period_start=now - timezone.timedelta(days=70),
            current_period_end=now - timezone.timedelta(days=40),
        )
        Subscription.objects.filter(pk=expired.pk).update(
            created_at=now - timezone.timedelta(days=60)
        )
        active = _active_sub(create_user)
        response = logged_in_client.post('/api/billing/cancel/')
        assert response.status_code == 200
        active.refresh_from_db()
        expired.refresh_from_db()
        assert active.status == 'cancelled'
        assert expired.status == 'expired'
