"""GET /api/billing/status/{txn_id}/ — the 5.6 payment-polling endpoint.

Contract (Winston Q1-Q3): txnId = the Chargily checkout id (5.2 D14 — the
create-checkout response id, never a payment_transactions id). The row is
resolved USER-SCOPED and SINCE-BOUND: ``since`` is REQUIRED (an ISO
datetime) — the FE echoes the server-issued checkout ``started_at`` back,
so a row created before the checkout began can never be that checkout's
row. The lookup NEVER relies on ``chargily_metadata.checkout_id`` (that
field stores the webhook event id — deferred-work 5.2 B13); the exact
checkout-id match is V1.5 behind the docs gate.

Response: ``{id, status, type, credits_granted, date}`` — RAW codes
(ledger precedent — the FE localizes per AD-8); no row in range returns
the SAME shape with ``status='pending'`` and nulls (absence is a state —
never 404 mid-poll); refunded rows report raw (the FE maps refunded into
the failed family). 401 anonymous; 400 for absent/malformed ``since`` or an
oversized txnId (never a silent default).
"""

from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone

from apps.billing.models import PaymentTransaction

pytestmark = pytest.mark.django_db


def _txn(
    user: Any,
    *,
    status: str = 'pending',
    txn_type: str = 'pack_purchase',
    credits_granted: int | None = None,
    minutes_ago: int = 1,
) -> Any:
    return PaymentTransaction.objects.create(
        user=user,
        chargily_event_id=f'evt_{txn_type}_{minutes_ago}_{user.pk}_{abs(hash(status))}',
        type=txn_type,
        amount_dzd=500,
        status=status,
        credits_granted=credits_granted,
        created_at=timezone.now() - timedelta(minutes=minutes_ago),
    )


def _since(**kwargs: Any) -> str:
    value: Any = timezone.now() - timedelta(**kwargs)
    return str(value.isoformat())


class TestStatusViewAuthentication:
    def test_requires_authentication(self, api_client: Any) -> None:
        response = api_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=30)}
        )
        assert response.status_code == 401


class TestStatusViewContract:
    def test_since_is_required(self, logged_in_client: Any) -> None:
        response = logged_in_client.get('/api/billing/status/some-checkout-id/')
        assert response.status_code == 400

    def test_malformed_since_rejected(self, logged_in_client: Any) -> None:
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': 'not-a-date'}
        )
        assert response.status_code == 400

    def test_ancient_since_rejected(self, logged_in_client: Any) -> None:
        # Review P5: the window cap — a tampered stash with an ancient
        # started_at must not defeat the false-success guard.
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(hours=48)}
        )
        assert response.status_code == 400

    def test_oversized_txn_id_rejected(self, logged_in_client: Any) -> None:
        response = logged_in_client.get(
            f'/api/billing/status/{"x" * 256}/', {'since': _since(minutes=30)}
        )
        assert response.status_code == 400

    def test_no_row_in_range_returns_pending_shape(
        self, logged_in_client: Any
    ) -> None:
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=30)}
        )
        assert response.status_code == 200
        assert response.data == {
            'id': None,
            'status': 'pending',
            'type': None,
            'credits_granted': None,
            'date': None,
        }

    def test_pending_row_returns_pending(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        _txn(create_user, status='pending', minutes_ago=1)
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=30)}
        )
        assert response.status_code == 200
        assert response.data['status'] == 'pending'
        assert response.data['type'] == 'pack_purchase'

    def test_succeeded_row_returns_raw_contract(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        row = _txn(
            create_user,
            status='succeeded',
            txn_type='pack_purchase',
            credits_granted=75,
            minutes_ago=1,
        )
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=30)}
        )
        assert response.status_code == 200
        assert response.data == {
            'id': str(row.id),
            'status': 'succeeded',
            'type': 'pack_purchase',
            'credits_granted': 75,
            'date': row.created_at.isoformat(),
        }

    def test_failed_row_reported_raw(self, logged_in_client: Any, create_user: Any) -> None:
        _txn(create_user, status='failed', credits_granted=None, minutes_ago=1)
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=30)}
        )
        assert response.data['status'] == 'failed'
        assert response.data['credits_granted'] is None

    def test_refunded_row_reported_raw(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        _txn(create_user, status='refunded', credits_granted=75, minutes_ago=1)
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=30)}
        )
        assert response.status_code == 200
        assert response.data['status'] == 'refunded'

    def test_latest_row_wins(self, logged_in_client: Any, create_user: Any) -> None:
        old = _txn(create_user, status='succeeded', credits_granted=75, minutes_ago=10)
        fresh = _txn(create_user, status='pending', minutes_ago=1)
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=30)}
        )
        assert response.data['id'] == str(fresh.id)
        assert response.data['status'] == 'pending'
        assert response.data['id'] != str(old.id)

    def test_row_created_before_since_is_excluded(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        # The false-success regression guard (Winston Q1 — option (c) risk):
        # a succeeded row from a PREVIOUS checkout (before this checkout
        # started) must never flip the card.
        _txn(create_user, status='succeeded', credits_granted=75, minutes_ago=10)
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=5)}
        )
        assert response.data['status'] == 'pending'
        assert response.data['id'] is None

    def test_user_isolation(self, logged_in_client: Any, create_user: Any) -> None:
        # User B's succeeded row must never be visible to user A.
        from django.contrib.auth import get_user_model

        other = create_user
        other.email = 'other@example.com'
        other.save(update_fields=['email'])
        _txn(other, status='succeeded', credits_granted=75, minutes_ago=1)

        a = get_user_model().objects.create_user(
            email='a@example.com', password='SecurePass123!', locale='en'
        )
        a.email_verified_at = timezone.now()
        a.save(update_fields=['email_verified_at'])
        _txn(a, status='pending', minutes_ago=1)
        # log in as user A
        api = logged_in_client
        api.post(
            '/api/auth/login/',
            {'email': 'a@example.com', 'password': 'SecurePass123!'},
        )
        response = api.get(
            '/api/billing/status/some-checkout-id/', {'since': _since(minutes=30)}
        )
        assert response.status_code == 200
        assert response.data['id'] is not None
        assert response.data['status'] == 'pending'

    def test_naive_since_treated_as_utc(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        # SQLite stores naive-UTC; a naive `since` must compare consistently.
        _txn(create_user, status='succeeded', credits_granted=75, minutes_ago=1)
        naive_since = (timezone.now() - timedelta(minutes=30)).replace(tzinfo=None)
        response = logged_in_client.get(
            '/api/billing/status/some-checkout-id/', {'since': naive_since.isoformat()}
        )
        assert response.status_code == 200
        assert response.data['status'] == 'succeeded'
