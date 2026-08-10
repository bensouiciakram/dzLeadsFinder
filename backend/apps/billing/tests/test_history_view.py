"""GET /api/billing/history/ — the Payment History table's data surface.

Contract (Winston Q2 / John V4, 2026-08-10): ``{results: [...]}`` wrapper
(forward-compatible with pagination), newest-first (``-created_at``, ``-id``
— the P8 deterministic-ordering precedent), fixed cap of 50 rows at V1
(the LEDGER_PAGE_SIZE precedent), ALL statuses included (pending /
succeeded / failed / refunded — John V4: a pending row answers "my money
went somewhere" after a polling timeout; a failed row is the 5.5 failure
surface), raw type/status codes (the ledger precedent — localization is
frontend-owned per AD-8)::

    {results: [{id: str, date: ISO, amount_dzd: int, type: str,
                status: str, credits_granted: int|null}]}
"""

from typing import Any

import pytest
from django.utils import timezone

from apps.billing.models import PaymentTransaction

pytestmark = pytest.mark.django_db


def _txn(
    user: Any,
    *,
    event_id: str,
    txn_type: str = 'pack_purchase',
    amount_dzd: int = 500,
    status: str = 'succeeded',
    credits_granted: int | None = 75,
    minutes_ago: int = 60,
) -> Any:
    return PaymentTransaction.objects.create(
        user=user,
        chargily_event_id=event_id,
        type=txn_type,
        amount_dzd=amount_dzd,
        status=status,
        credits_granted=credits_granted,
        created_at=timezone.now() - timezone.timedelta(minutes=minutes_ago),
    )


class TestHistoryView:
    def test_requires_authentication(self, api_client: Any) -> None:
        response = api_client.get('/api/billing/history/')
        assert response.status_code == 401

    def test_empty_history_for_a_fresh_user(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        response = logged_in_client.get('/api/billing/history/')
        assert response.status_code == 200
        assert response.data == {'results': []}

    def test_returns_the_row_shape(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        from datetime import datetime

        _txn(create_user, event_id='evt-1')
        response = logged_in_client.get('/api/billing/history/')
        assert response.status_code == 200
        (row,) = response.data['results']
        assert row['amount_dzd'] == 500
        assert row['type'] == 'pack_purchase'
        assert row['status'] == 'succeeded'
        assert row['credits_granted'] == 75
        # The date is a real ISO timestamp WITH a tz offset (the FE
        # formatBillingDate contract — a naive datetime would render
        # locale-ambiguous cells; review P6).
        parsed = datetime.fromisoformat(row['date'])
        assert parsed.tzinfo is not None

    def test_newest_first_with_id_tiebreak(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """Same-microsecond rows order deterministically (review P8).

        UUID pks are random, so the -id tiebreak guarantees a STABLE order
        (two fetches agree), not a semantically meaningful one.
        """
        now = timezone.now()
        first = PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt-1',
            type='pack_purchase',
            amount_dzd=500,
            status='succeeded',
            created_at=now,
        )
        second = PaymentTransaction.objects.create(
            user=create_user,
            chargily_event_id='evt-2',
            type='pack_purchase',
            amount_dzd=500,
            status='succeeded',
            created_at=now,
        )
        first_fetch = logged_in_client.get('/api/billing/history/').data['results']
        second_fetch = logged_in_client.get('/api/billing/history/').data['results']
        ids = [row['id'] for row in first_fetch]
        assert set(ids) == {str(first.pk), str(second.pk)}
        assert [row['id'] for row in second_fetch] == ids

    def test_all_statuses_are_included(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        """John V4 — the table never collapses pending/failed/refunded rows."""
        _txn(
            create_user,
            event_id='evt-pending',
            status='pending',
            credits_granted=None,
            minutes_ago=5,
        )
        _txn(
            create_user,
            event_id='evt-failed',
            status='failed',
            credits_granted=None,
            minutes_ago=10,
        )
        _txn(
            create_user,
            event_id='evt-refunded',
            status='refunded',
            credits_granted=75,
            minutes_ago=15,
        )
        response = logged_in_client.get('/api/billing/history/')
        statuses = sorted(row['status'] for row in response.data['results'])
        assert statuses == ['failed', 'pending', 'refunded']

    def test_user_scoped_no_cross_user_leakage(
        self, logged_in_client: Any, create_user: Any, user_data: Any
    ) -> None:
        from apps.accounts.models import User as UserModel

        other = UserModel.objects.create_user(
            email='other@example.com',
            password='pw12345!',
            locale='en',
        )
        mine = _txn(create_user, event_id='evt-mine')
        _txn(other, event_id='evt-other')
        response = logged_in_client.get('/api/billing/history/')
        assert [row['id'] for row in response.data['results']] == [str(mine.pk)]

    def test_caps_at_fifty_rows(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        for i in range(55):
            _txn(create_user, event_id=f'evt-{i:03d}', minutes_ago=1000 + i)
        response = logged_in_client.get('/api/billing/history/')
        assert len(response.data['results']) == 50
