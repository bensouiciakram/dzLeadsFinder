"""Unit tests for the atomic N-row export debit (the 4.1 test_reveal.py pattern).

`debit_export_rows` opens NO transaction of its own — the caller owns the
atomic block and must call it as its FIRST statement (the SERIALIZABLE guard
pins there). The composed-transaction tests prove the contract.
"""

from collections.abc import Callable
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.credits.models import CreditEventType, CreditLedger
from apps.credits.services import InsufficientCreditsError, debit_export_rows

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def make_user(db: object) -> Callable[[], Any]:
    counter = {'n': 0}

    def _make_user() -> object:
        counter['n'] += 1
        return User.objects.create_user(
            email=f'debit-test-{counter["n"]}@example.com',
            password='SecurePass123!',
            locale='en',
        )

    return _make_user


def _grant(user: Any, amount: int, pool: str = 'subscription') -> None:
    CreditLedger.objects.create(
        user=user,
        event_type=CreditEventType.PROMOTIONAL_GRANT,
        amount=amount,
        balance_after=amount,
        pool=pool,
    )
    User.objects.filter(pk=getattr(user, 'id')).update(
        credits_balance=getattr(user, 'credits_balance', 0) + amount
    )
    user.credits_balance = getattr(user, 'credits_balance', 0) + amount


def _ledger_rows(user: Any) -> list[CreditLedger]:
    return list(CreditLedger.objects.filter(user_id=getattr(user, 'id')))


class TestDebitExportRows:
    def test_zero_and_negative_row_count_rejected(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        _grant(user, 10)
        for bad in (0, -3):
            with pytest.raises(ValueError):
                with transaction.atomic():
                    debit_export_rows(user, bad, 'ref')
        assert len(_ledger_rows(user)) == 1
        user.refresh_from_db()
        assert user.credits_balance == 10

    def test_n_row_debit(self, make_user: Callable[[], Any]) -> None:
        user = make_user()
        _grant(user, 10)
        with transaction.atomic():
            balance_after = debit_export_rows(user, 4, 'ref-1')
        assert balance_after == 6
        rows = _ledger_rows(user)
        debit_rows = [r for r in rows if r.event_type == CreditEventType.EXPORT_ROW_DEBIT]
        assert len(debit_rows) == 1
        row = debit_rows[0]
        assert row.amount == -4
        assert row.pool == 'subscription'
        assert row.balance_after == 6
        assert row.reference_id == 'ref-1'
        user.refresh_from_db()
        assert user.credits_balance == 6

    def test_drawdown_subscription_first_whole_n(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        _grant(user, 3)
        _grant(user, 5, pool='pack')
        with transaction.atomic():
            debit_export_rows(user, 2, 'ref')
        row = [
            r for r in _ledger_rows(user) if r.event_type == CreditEventType.EXPORT_ROW_DEBIT
        ][0]
        assert row.pool == 'subscription'

    def test_drawdown_pack_when_subscription_insufficient(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        _grant(user, 0, pool='subscription')
        _grant(user, 8, pool='pack')
        with transaction.atomic():
            debit_export_rows(user, 6, 'ref')
        row = [
            r for r in _ledger_rows(user) if r.event_type == CreditEventType.EXPORT_ROW_DEBIT
        ][0]
        assert row.pool == 'pack'

    def test_drawdown_pack_when_whole_n_exceeds_subscription(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        _grant(user, 2)
        _grant(user, 8, pool='pack')
        with transaction.atomic():
            balance_after = debit_export_rows(user, 6, 'ref')
        row = [
            r for r in _ledger_rows(user) if r.event_type == CreditEventType.EXPORT_ROW_DEBIT
        ][0]
        assert row.pool == 'pack'
        assert row.balance_after == 4
        assert balance_after == 4

    def test_insufficient_balance_raises_nothing_written(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        _grant(user, 5)
        with pytest.raises(InsufficientCreditsError):
            with transaction.atomic():
                debit_export_rows(user, 6, 'ref')
        assert len(_ledger_rows(user)) == 1
        user.refresh_from_db()
        assert user.credits_balance == 5

    def test_balance_from_ledger_never_cache(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        User.objects.filter(pk=getattr(user, 'id')).update(credits_balance=5)
        user.refresh_from_db()
        with pytest.raises(InsufficientCreditsError):
            with transaction.atomic():
                debit_export_rows(user, 1, 'ref')
        assert len(_ledger_rows(user)) == 0

    def test_composed_transaction_commits_on_exit(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        _grant(user, 10)
        with transaction.atomic():
            debit_export_rows(user, 3, 'ref')
        assert len(_ledger_rows(user)) == 2
        user.refresh_from_db()
        assert user.credits_balance == 7

    def test_rollback_within_same_block(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        _grant(user, 10)
        with pytest.raises(RuntimeError):
            with transaction.atomic():
                debit_export_rows(user, 3, 'ref')
                raise RuntimeError('boom')
        rows = _ledger_rows(user)
        assert len(rows) == 1
        assert all(
            r.event_type != CreditEventType.EXPORT_ROW_DEBIT for r in rows
        )
        user.refresh_from_db()
        assert user.credits_balance == 10

    def test_reference_id_and_running_balance(
        self, make_user: Callable[[], Any]
    ) -> None:
        user = make_user()
        _grant(user, 7)
        with transaction.atomic():
            debit_export_rows(user, 2, 'export-abc')
        rows = _ledger_rows(user)
        debit = [
            r for r in rows if r.event_type == CreditEventType.EXPORT_ROW_DEBIT
        ][0]
        assert debit.reference_id == 'export-abc'
        assert debit.balance_after == 5
