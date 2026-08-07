"""Signup free-credit ledger row: the 2.2 defer closes here (AD-4 source of truth)."""

import importlib
from typing import Any, cast

import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import SingleUseToken
from apps.credits.models import CreditLedger
from apps.credits.services import user_balances

User = get_user_model()

pytestmark = pytest.mark.django_db


def _make_token(user: Any) -> SingleUseToken:
    return cast(
        SingleUseToken,
        SingleUseToken.objects.create(
            user=user,
            purpose='verify',
            token='ledger-token-' + user.email,
            expires_at=timezone.now() + timezone.timedelta(hours=24),
        ),
    )


def _verify(client: Client, token: str) -> Any:
    return client.get(f'/api/auth/verify-email/{token}/')


class TestFreeSignupLedgerRow:
    def test_verify_creates_free_signup_ledger_row(
        self, api_client: Client, create_user: Any
    ) -> None:
        entry = _make_token(create_user)
        response = _verify(api_client, entry.token)
        assert response.status_code == status.HTTP_200_OK

        row = CreditLedger.objects.get(user=create_user)
        assert row.event_type == 'free_signup'
        assert row.amount == 15
        assert row.balance_after == 15
        assert row.pool == 'subscription'
        assert row.user_id == create_user.id

    def test_verify_replay_does_not_duplicate_the_ledger_row(
        self, api_client: Client, create_user: Any
    ) -> None:
        entry = _make_token(create_user)
        _verify(api_client, entry.token)
        _verify(api_client, entry.token)
        assert CreditLedger.objects.filter(user=create_user).count() == 1

    def test_unverified_signup_has_no_ledger_row(self, create_user: Any) -> None:
        assert CreditLedger.objects.filter(user=create_user).count() == 0
        assert create_user.credits_balance == 0

    def test_reconciliation_invariant_after_verify(
        self, api_client: Client, create_user: Any
    ) -> None:
        entry = _make_token(create_user)
        _verify(api_client, entry.token)
        create_user.refresh_from_db()
        balances = user_balances(create_user)
        assert balances['display_balance'] == 15
        assert create_user.credits_balance == 15
        assert balances['display_balance'] == create_user.credits_balance


class TestBackfillMigration:
    def _run(self) -> None:
        module = importlib.import_module('apps.credits.migrations.0002_backfill_free_signup_ledger')
        module.backfill(apps, None)

    def test_backfills_free_signup_rows_for_cached_credits_without_ledger(
        self, create_user: Any
    ) -> None:
        create_user.credits_balance = 15
        create_user.save(update_fields=['credits_balance'])
        self._run()
        row = CreditLedger.objects.get(user=create_user)
        assert row.event_type == 'free_signup'
        assert row.amount == 15
        assert row.balance_after == 15
        assert row.pool == 'subscription'

    def test_backfill_uses_the_actual_remaining_cache_not_a_hardcoded_15(
        self, create_user: Any
    ) -> None:
        """A 2.2-era user who already spent credits must not be double-granted."""
        create_user.credits_balance = 5
        create_user.save(update_fields=['credits_balance'])
        self._run()
        row = CreditLedger.objects.get(user=create_user)
        assert row.amount == 5
        assert row.balance_after == 5
        assert user_balances(create_user)['display_balance'] == 5

    def test_backfill_closes_the_gap_when_other_ledger_rows_exist(
        self, create_user: Any
    ) -> None:
        """A user with a promotional grant but no free credits still gets the gap."""
        CreditLedger.objects.create(
            user=create_user,
            event_type='promotional_grant',
            amount=5,
            balance_after=5,
            pool='subscription',
        )
        create_user.credits_balance = 20
        create_user.save(update_fields=['credits_balance'])
        self._run()
        rows = CreditLedger.objects.filter(user=create_user).order_by('pk')
        assert rows.count() == 2
        backfill_row = rows.last()
        assert backfill_row.event_type == 'free_signup'
        assert backfill_row.amount == 15
        assert backfill_row.balance_after == 20
        assert user_balances(create_user)['display_balance'] == 20

    def test_backfill_skips_users_whose_ledger_already_covers_the_cache(
        self, create_user: Any
    ) -> None:
        CreditLedger.objects.create(
            user=create_user,
            event_type='pack_grant',
            amount=6,
            balance_after=6,
            pool='pack',
        )
        create_user.credits_balance = 5
        create_user.save(update_fields=['credits_balance'])
        self._run()
        assert CreditLedger.objects.filter(user=create_user).count() == 1

    def test_backfill_skips_users_with_zero_balance(self, create_user: Any) -> None:
        self._run()
        assert CreditLedger.objects.filter(user=create_user).count() == 0

    def test_backfill_skips_users_with_existing_ledger_rows(
        self, api_client: Client, create_user: Any
    ) -> None:
        entry = _make_token(create_user)
        _verify(api_client, entry.token)
        self._run()
        assert CreditLedger.objects.filter(user=create_user).count() == 1

    def test_backfill_reverse_removes_only_backfill_rows(self, create_user: Any) -> None:
        create_user.credits_balance = 15
        create_user.save(update_fields=['credits_balance'])
        module = importlib.import_module('apps.credits.migrations.0002_backfill_free_signup_ledger')
        module.backfill(apps, None)
        module.unbackfill(apps, None)
        assert CreditLedger.objects.filter(user=create_user).count() == 0
        assert CreditLedger.objects.filter(
            description='Free signup credits (backfill)'
        ).count() == 0
