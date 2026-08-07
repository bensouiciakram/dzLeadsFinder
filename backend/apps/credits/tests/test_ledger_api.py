"""Ledger API endpoint tests: GET /api/credits/ledger/.

Covers the AC contract: 90-day window, newest-first ordering, strict
pagination (50/page), the search-shape payload mirror, RAW event_type
codes (localization is frontend-owned), ISO-8601 timestamps, and the
auth-layer policy for anonymous and frozen users.
"""

import uuid
from datetime import timedelta
from typing import Any, Callable, cast

import pytest
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.test import Client
from django.utils import timezone

from apps.credits.models import CreditLedger

User = get_user_model()

_Session = Callable[..., tuple[Client, Any]]
_Grant = Callable[..., Any]

pytestmark = pytest.mark.django_db


@pytest.fixture
def ledger_session(api_client: Client) -> _Session:
    def _login(locale: str = 'en') -> tuple[Client, Any]:
        email = f'{uuid.uuid4().hex}@example.com'
        user = User.objects.create_user(
            email=email, password='SecurePass123!', locale=locale
        )
        user.email_verified_at = timezone.now()
        user.save(update_fields=['email_verified_at'])
        api_client.post('/api/auth/login/', {'email': email, 'password': 'SecurePass123!'})
        return api_client, user

    return _login


@pytest.fixture
def grant(ledger_session: _Session) -> Callable[..., Any]:
    def _grant(
        user: Any,
        amount: int,
        pool: str = 'subscription',
        event: str = 'subscription_grant',
        reference_id: str | None = None,
        created_at: Any = None,
    ) -> CreditLedger:
        total = (
            CreditLedger.objects.filter(user=user).aggregate(total=Sum('amount'))['total'] or 0
        )
        row = CreditLedger.objects.create(
            user=user,
            event_type=event,
            amount=amount,
            balance_after=total + amount,
            pool=pool,
            reference_id=reference_id,
        )
        if created_at is not None:
            CreditLedger.objects.filter(pk=row.pk).update(created_at=created_at)
        return cast(CreditLedger, CreditLedger.objects.get(pk=row.pk))

    return _grant


class TestAuth:
    def test_anonymous_rejected(self, api_client: Client) -> None:
        response = api_client.get('/api/credits/ledger/')
        assert response.status_code == 401

    def test_frozen_user_rejected_by_auth_policy(self, ledger_session: _Session) -> None:
        client, user = ledger_session()
        user.deleted_at = timezone.now()
        user.deletion_scheduled_at = timezone.now() + timedelta(days=7)
        user.save(update_fields=['deleted_at', 'deletion_scheduled_at'])
        response = client.get('/api/credits/ledger/')
        assert response.status_code == 401
        assert response.json()['code'] == 'account_deleted'


class TestLedgerWindow:
    def test_empty_ledger_returns_empty_page(self, ledger_session: _Session) -> None:
        client, _user = ledger_session()
        response = client.get('/api/credits/ledger/')
        assert response.status_code == 200
        assert response.json() == {
            'results': [],
            'total': 0,
            'page': 1,
            'truncated': False,
        }

    def test_includes_rows_within_90_days(self, ledger_session: _Session, grant: _Grant) -> None:
        client, user = ledger_session()
        grant(user, 15, event='free_signup')
        grant(
            user,
            5,
            event='pack_grant',
            pool='pack',
            created_at=timezone.now() - timedelta(days=80),
        )
        response = client.get('/api/credits/ledger/')
        assert response.status_code == 200
        body = response.json()
        assert body['total'] == 2
        assert len(body['results']) == 2

    def test_excludes_rows_older_than_90_days(
        self, ledger_session: _Session, grant: _Grant
    ) -> None:
        client, user = ledger_session()
        grant(user, 15, event='free_signup')
        grant(
            user,
            5,
            event='pack_grant',
            pool='pack',
            created_at=timezone.now() - timedelta(days=95),
        )
        response = client.get('/api/credits/ledger/')
        body = response.json()
        assert body['total'] == 1
        assert len(body['results']) == 1
        assert body['results'][0]['event_type'] == 'free_signup'


class TestOrderingAndShape:
    def test_newest_first(self, ledger_session: _Session, grant: _Grant) -> None:
        client, user = ledger_session()
        oldest = grant(
            user,
            5,
            event='pack_grant',
            pool='pack',
            created_at=timezone.now() - timedelta(hours=2),
        )
        middle = grant(
            user, 15, event='free_signup', created_at=timezone.now() - timedelta(hours=1)
        )
        newest = grant(user, 3, event='promotional_grant', created_at=timezone.now())
        response = client.get('/api/credits/ledger/')
        results = response.json()['results']
        assert [row['id'] for row in results] == [
            str(newest.id),
            str(middle.id),
            str(oldest.id),
        ]

    def test_row_shape_exact_keys(self, ledger_session: _Session, grant: _Grant) -> None:
        client, user = ledger_session()
        grant(user, 15, event='free_signup', reference_id='ref-123')
        response = client.get('/api/credits/ledger/')
        row = response.json()['results'][0]
        assert set(row) == {
            'id',
            'event_type',
            'amount',
            'balance_after',
            'reference_id',
            'created_at',
        }

    def test_event_type_is_raw_code(self, ledger_session: _Session, grant: _Grant) -> None:
        client, user = ledger_session()
        grant(user, 15, event='free_signup')
        grant(user, 200, event='subscription_grant')
        grant(user, -1, event='reveal_debit', pool='subscription')
        response = client.get('/api/credits/ledger/')
        types = [row['event_type'] for row in response.json()['results']]
        assert types == ['reveal_debit', 'subscription_grant', 'free_signup']

    def test_reference_id_passthrough(self, ledger_session: _Session, grant: _Grant) -> None:
        client, user = ledger_session()
        grant(user, 15, event='free_signup', reference_id='abc-123')
        response = client.get('/api/credits/ledger/')
        assert response.json()['results'][0]['reference_id'] == 'abc-123'

    def test_created_at_is_iso8601(self, ledger_session: _Session, grant: _Grant) -> None:
        from datetime import datetime

        client, user = ledger_session()
        grant(user, 15, event='free_signup')
        response = client.get('/api/credits/ledger/')
        created_at = response.json()['results'][0]['created_at']
        parsed = datetime.fromisoformat(created_at)
        assert parsed.tzinfo is not None

    def test_same_instant_rows_have_deterministic_order(
        self, ledger_session: _Session, grant: _Grant
    ) -> None:
        """Ties on created_at (batch grants, the 4.1 backfill) must be broken
        by id — otherwise rows can duplicate/skip across page boundaries."""
        client, user = ledger_session()
        first = grant(user, 5, event='pack_grant', pool='pack', created_at=timezone.now())
        second = grant(user, 3, event='pack_grant', pool='pack', created_at=first.created_at)
        third = grant(user, 1, event='pack_grant', pool='pack', created_at=first.created_at)
        response = client.get('/api/credits/ledger/')
        results = response.json()['results']
        assert [row['id'] for row in results] == [
            str(third.id),
            str(second.id),
            str(first.id),
        ]
        first_page = client.get('/api/credits/ledger/').json()['results']
        second_page = client.get('/api/credits/ledger/').json()['results']
        assert first_page == second_page


class TestPagination:
    def test_first_page_returns_page_size_rows_and_total(
        self, ledger_session: _Session, grant: _Grant
    ) -> None:
        client, user = ledger_session()
        for index in range(55):
            grant(user, 1, event='pack_grant', pool='pack')
        response = client.get('/api/credits/ledger/')
        body = response.json()
        assert len(body['results']) == 50
        assert body['total'] == 55
        assert body['page'] == 1
        assert body['truncated'] is False

    def test_second_page_returns_remainder(self, ledger_session: _Session, grant: _Grant) -> None:
        client, user = ledger_session()
        for index in range(55):
            grant(user, 1, event='pack_grant', pool='pack')
        response = client.get('/api/credits/ledger/', {'page': 2})
        body = response.json()
        assert len(body['results']) == 5
        assert body['total'] == 55
        assert body['page'] == 2

    def test_out_of_range_page_returns_empty_results(
        self, ledger_session: _Session, grant: _Grant
    ) -> None:
        client, user = ledger_session()
        for index in range(3):
            grant(user, 1, event='pack_grant', pool='pack')
        response = client.get('/api/credits/ledger/', {'page': 9})
        body = response.json()
        assert response.status_code == 200
        assert body['results'] == []
        assert body['total'] == 3

    def test_pages_do_not_overlap(
        self, ledger_session: _Session, grant: _Grant
    ) -> None:
        client, user = ledger_session()
        for index in range(55):
            grant(user, 1, event='pack_grant', pool='pack')
        first = client.get('/api/credits/ledger/', {'page': 1}).json()['results']
        second = client.get('/api/credits/ledger/', {'page': 2}).json()['results']
        first_ids = {row['id'] for row in first}
        assert len(first_ids) == 50
        assert {row['id'] for row in second}.isdisjoint(first_ids)


class TestPageValidation:
    def test_page_zero_rejected(self, ledger_session: _Session) -> None:
        client, _user = ledger_session()
        response = client.get('/api/credits/ledger/', {'page': 0})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_non_numeric_page_rejected(self, ledger_session: _Session) -> None:
        client, _user = ledger_session()
        response = client.get('/api/credits/ledger/', {'page': 'abc'})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_page_rejects_int_coercion_leniency(self, ledger_session: _Session) -> None:
        """Python int() would accept '+5', '1_0' and ' 5 ' — the contract is
        a plain digits-only positive integer (the strict-parse precedent)."""
        client, _user = ledger_session()
        for raw in ('+5', '1_0', ' 5 ', '5 ', '1e3'):
            response = client.get('/api/credits/ledger/', {'page': raw})
            assert response.status_code == 400, raw
            assert response.json()['code'] == 'invalid_payload'

    def test_huge_page_rejected_not_500(self, ledger_session: _Session) -> None:
        """A page whose OFFSET overflows PostgreSQL's signed 64-bit range
        must be a 400 — not an uncaught OperationalError → 500."""
        client, _user = ledger_session()
        response = client.get('/api/credits/ledger/', {'page': '9223372036854775808'})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_empty_page_rejected(self, ledger_session: _Session) -> None:
        client, _user = ledger_session()
        response = client.get('/api/credits/ledger/', {'page': ''})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'
