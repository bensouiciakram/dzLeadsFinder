"""Balance read computation tests: pool-based sums from the ledger."""

from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db.models import Sum

from apps.credits.models import CreditLedger
from apps.credits.services import user_balances

User = get_user_model()

pytestmark = pytest.mark.django_db


def _grant(user: Any, amount: int, pool: str = 'subscription') -> None:
    running = (
        CreditLedger.objects.filter(user=user).aggregate(total=Sum('amount'))['total'] or 0
    )
    CreditLedger.objects.create(
        user=user,
        event_type='subscription_grant' if pool == 'subscription' else 'pack_grant',
        amount=amount,
        balance_after=running + amount,
        pool=pool,
    )


class TestUserBalances:
    def test_empty_ledger_returns_zeros(self, create_user: Any) -> None:
        assert user_balances(create_user) == {
            'subscription_balance': 0,
            'pack_balance': 0,
            'display_balance': 0,
        }

    def test_only_subscription_rows(self, create_user: Any) -> None:
        _grant(create_user, 3)
        _grant(create_user, -1)
        assert user_balances(create_user) == {
            'subscription_balance': 2,
            'pack_balance': 0,
            'display_balance': 2,
        }

    def test_only_pack_rows(self, create_user: Any) -> None:
        _grant(create_user, 10, pool='pack')
        _grant(create_user, -4, pool='pack')
        assert user_balances(create_user) == {
            'subscription_balance': 0,
            'pack_balance': 6,
            'display_balance': 6,
        }

    def test_mixed_pools_sum_separately(self, create_user: Any) -> None:
        _grant(create_user, 15)
        _grant(create_user, 10, pool='pack')
        _grant(create_user, -1)
        _grant(create_user, -2, pool='pack')
        assert user_balances(create_user) == {
            'subscription_balance': 14,
            'pack_balance': 8,
            'display_balance': 22,
        }

    def test_balances_never_leak_across_users(self, create_user: Any) -> None:
        other = User.objects.create_user(email='other@example.com', password='SecurePass123!')
        _grant(create_user, 15)
        _grant(create_user, -3)
        _grant(other, 42)
        assert user_balances(create_user) == {
            'subscription_balance': 12,
            'pack_balance': 0,
            'display_balance': 12,
        }
        assert user_balances(other)['display_balance'] == 42

    def test_reconciliation_last_balance_after_equals_display(self, create_user: Any) -> None:
        _grant(create_user, 15)
        _grant(create_user, -1)
        _grant(create_user, 5, pool='pack')
        last = CreditLedger.objects.filter(user=create_user).order_by('pk').last()
        display = user_balances(create_user)['display_balance']
        assert last.balance_after == display == 19

    def test_balance_is_never_read_from_the_cache_column(self, create_user: Any) -> None:
        create_user.credits_balance = 999
        create_user.save(update_fields=['credits_balance'])
        assert user_balances(create_user)['display_balance'] == 0
