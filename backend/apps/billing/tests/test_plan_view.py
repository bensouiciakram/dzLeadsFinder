"""GET /api/billing/plan/ — the 5.3 forward contract for the 5.7 chip + 5.5 page.

Contract (5.3 D12): ``{tier, status, renews_on}`` — tier = user.tier (the
split-brain owner), status = the latest subscription row's status or null,
renews_on = ISO 'YYYY-MM-DD' (local date of current_period_end) or null.
200 always (free users get the stable free shape — the header renders on
every surface). RAW data — the FE formats per AD-8.
"""

from datetime import timedelta
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
        current_period_start=now - timedelta(days=30 - days_remaining),
        current_period_end=now + timedelta(days=days_remaining),
    )


class TestPlanView:
    def test_requires_authentication(self, api_client: Any) -> None:
        response = api_client.get('/api/billing/plan/')
        assert response.status_code == 401

    def test_starter_active_subscription(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        sub = _active_sub(create_user)
        create_user.tier = 'starter'
        create_user.save(update_fields=['tier'])
        response = logged_in_client.get('/api/billing/plan/')
        assert response.status_code == 200
        assert response.data['tier'] == 'starter'
        assert response.data['status'] == 'active'
        assert response.data['renews_on'] == timezone.localdate(
            sub.current_period_end
        ).isoformat()
        assert response.data['balances'] == {
            'subscription_balance': 0,
            'pack_balance': 0,
            'display_balance': 0,
        }

    def test_free_user_stable_shape(self, logged_in_client: Any) -> None:
        response = logged_in_client.get('/api/billing/plan/')
        assert response.status_code == 200
        assert response.data == {
            'tier': 'free',
            'status': None,
            'renews_on': None,
            # The 5.5 additive balances key (Winston Q4) — a fresh user has
            # an empty ledger.
            'balances': {
                'subscription_balance': 0,
                'pack_balance': 0,
                'display_balance': 0,
            },
        }

    def test_failed_renewal_keeps_renews_on(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """The banner grace copy reads renews_on too (Sally Q1)."""
        now = timezone.now()
        sub = Subscription.objects.create(
            user=create_user,
            status='failed_renewal',
            current_period_start=now - timedelta(days=40),
            current_period_end=now + timedelta(days=5),
        )
        create_user.tier = 'starter'
        create_user.save(update_fields=['tier'])
        response = logged_in_client.get('/api/billing/plan/')
        assert response.status_code == 200
        assert response.data['status'] == 'failed_renewal'
        assert response.data['renews_on'] == timezone.localdate(
            sub.current_period_end
        ).isoformat()

    def test_latest_row_wins(self, logged_in_client: Any, create_user: Any) -> None:
        """Expired history + active row → the active row (Sally Q1 — the
        endpoint must never return a dead row)."""
        now = timezone.now()
        expired = Subscription.objects.create(
            user=create_user,
            status='expired',
            current_period_start=now - timedelta(days=70),
            current_period_end=now - timedelta(days=40),
        )
        Subscription.objects.filter(pk=expired.pk).update(
            created_at=now - timedelta(days=60)
        )
        active = _active_sub(create_user)
        create_user.tier = 'starter'
        create_user.save(update_fields=['tier'])
        response = logged_in_client.get('/api/billing/plan/')
        assert response.status_code == 200
        assert response.data['status'] == 'active'
        assert response.data['renews_on'] == timezone.localdate(
            active.current_period_end
        ).isoformat()

    def test_cancelled_subscription_status_surface(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """cancelled/expired stay reachable (5.5/FR-26 future-proofing —
        Sally Q1)."""
        now = timezone.now()
        Subscription.objects.create(
            user=create_user,
            status='cancelled',
            cancelled_at=now,
            current_period_start=now - timedelta(days=30),
            current_period_end=now + timedelta(days=5),
        )
        create_user.tier = 'starter'
        create_user.save(update_fields=['tier'])
        response = logged_in_client.get('/api/billing/plan/')
        assert response.status_code == 200
        assert response.data['status'] == 'cancelled'
        assert response.data['tier'] == 'starter'


class TestPlanViewBalances:
    """The 5.5 additive `balances` key (Winston Q4 — the Plan Card's
    "credits left this cycle" comes from the subscription pool).

    The 5.3 contract {tier, status, renews_on} is preserved — additive key
    only, so the 5.7 chip/banner consumers are untouched.
    """

    def _seed_balances(self, user: Any) -> None:
        from apps.credits.models import CreditEventType, CreditLedger, CreditPool

        CreditLedger.objects.create(
            user=user,
            event_type=CreditEventType.SUBSCRIPTION_GRANT,
            amount=200,
            balance_after=200,
            pool=CreditPool.SUBSCRIPTION,
        )
        CreditLedger.objects.create(
            user=user,
            event_type=CreditEventType.PACK_GRANT,
            amount=75,
            balance_after=275,
            pool=CreditPool.PACK,
        )

    def test_free_user_balances_all_zero(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        response = logged_in_client.get('/api/billing/plan/')
        assert response.data['balances'] == {
            'subscription_balance': 0,
            'pack_balance': 0,
            'display_balance': 0,
        }

    def test_starter_plan_includes_cycle_balances(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        from datetime import timedelta

        sub = Subscription.objects.create(
            user=create_user,
            status='active',
            current_period_start=timezone.now() - timedelta(days=10),
            current_period_end=timezone.now() + timedelta(days=20),
        )
        self._seed_balances(create_user)
        response = logged_in_client.get('/api/billing/plan/')
        assert response.data['tier'] == 'free'
        assert response.data['status'] == 'active'
        assert response.data['renews_on'] == timezone.localdate(
            sub.current_period_end
        ).isoformat()
        assert response.data['balances'] == {
            'subscription_balance': 200,
            'pack_balance': 75,
            'display_balance': 275,
        }

    def test_plan_shape_unchanged_without_balances(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """The 5.3 key set is preserved — only the additive key is new."""
        response = logged_in_client.get('/api/billing/plan/')
        assert set(response.data.keys()) == {
            'tier',
            'status',
            'renews_on',
            'balances',
        }
