"""Reveal API endpoint tests: POST /api/reveal/{type}/{id}/.

Covers the AC contract: JWT validation, atomic deduction, contact payload,
re-reveal idempotency (free within 30d), localized error mapping, and the
auth-layer policy for frozen users.
"""

import uuid
from datetime import timedelta
from typing import Any, Callable, cast

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, OperationalError
from django.db.models import F, Sum
from django.test import Client
from django.utils import timezone

from apps.credits.messages import INSUFFICIENT_CREDITS_MESSAGES
from apps.credits.models import CreditLedger, Reveal
from apps.search.models import Company, Person

User = get_user_model()

_Session = Callable[..., tuple[Client, Any]]

pytestmark = pytest.mark.django_db


@pytest.fixture
def person() -> Person:
    company = Company.objects.create(
        name='ACME Algérie', website='https://acme.dz', source='seed'
    )
    return cast(
        Person,
        Person.objects.create(
            name='Karim Benali',
            role='CEO',
            email='karim@acme.dz',
            phone='0550 12 34 56',
            address='Alger Centre, Alger',
            company=company,
            source='seed',
        ),
    )


@pytest.fixture
def company() -> Company:
    return cast(
        Company,
        Company.objects.create(name='ACME Algérie', website='https://acme.dz', source='seed'),
    )


@pytest.fixture
def reveal_session(api_client: Client) -> _Session:
    def _login(locale: str = 'en', tier: str = 'free') -> tuple[Client, Any]:
        email = f'{uuid.uuid4().hex}@example.com'
        user = User.objects.create_user(
            email=email, password='SecurePass123!', locale=locale, tier=tier
        )
        user.email_verified_at = timezone.now()
        user.save(update_fields=['email_verified_at'])
        api_client.post('/api/auth/login/', {'email': email, 'password': 'SecurePass123!'})
        return api_client, user

    return _login


@pytest.fixture
def grant(reveal_session: _Session) -> Callable[..., Any]:
    def _grant(
        user: Any, amount: int, pool: str = 'subscription', event: str = 'subscription_grant'
    ) -> Any:
        user.refresh_from_db()
        total = (
            CreditLedger.objects.filter(user=user).aggregate(total=Sum('amount'))['total'] or 0
        )
        CreditLedger.objects.create(
            user=user,
            event_type=event,
            amount=amount,
            balance_after=total + amount,
            pool=pool,
        )
        User.objects.filter(pk=user.pk).update(credits_balance=F('credits_balance') + amount)
        user.refresh_from_db()
        return user

    return _grant


class TestAuth:
    def test_anonymous_rejected(self, api_client: Client, person: Person) -> None:
        response = api_client.post(f'/api/reveal/people/{person.id}/')
        assert response.status_code == 401

    def test_frozen_user_rejected_by_auth_policy(
        self, reveal_session: _Session, person: Person
    ) -> None:
        client, user = reveal_session()
        user.deleted_at = timezone.now()
        user.deletion_scheduled_at = timezone.now() + timedelta(days=7)
        user.save(update_fields=['deleted_at', 'deletion_scheduled_at'])
        response = client.post(f'/api/reveal/people/{person.id}/')
        assert response.status_code == 401
        assert response.json()['code'] == 'account_deleted'

    def test_unverified_email_rejected(self, api_client: Client, person: Person) -> None:
        email = f'{uuid.uuid4().hex}@example.com'
        User.objects.create_user(email=email, password='SecurePass123!', locale='en')
        api_client.post('/api/auth/login/', {'email': email, 'password': 'SecurePass123!'})
        response = api_client.post(f'/api/reveal/people/{person.id}/')
        assert response.status_code == 401
        assert response.json()['code'] == 'email_not_verified'


class TestRevealPeople:
    def test_happy_path_returns_contact_balances_and_writes_ledger(
        self, reveal_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = reveal_session()
        grant(user, 3)
        response = client.post(f'/api/reveal/people/{person.id}/')

        assert response.status_code == 200
        body = response.json()
        assert set(body) == {'contact', 'balances'}
        contact = body['contact']
        assert set(contact) == {
            'record_type', 'record_id', 'name', 'role', 'company_name',
            'email', 'phone', 'address',
        }
        assert contact['record_type'] == 'people'
        assert contact['record_id'] == str(person.id)
        assert contact['name'] == 'Karim Benali'
        assert contact['email'] == 'karim@acme.dz'
        assert contact['phone'] == '0550 12 34 56'
        assert contact['address'] == 'Alger Centre, Alger'
        assert contact['company_name'] == 'ACME Algérie'
        assert body['balances'] == {
            'subscription_balance': 2,
            'pack_balance': 0,
            'display_balance': 2,
        }

        ledger = CreditLedger.objects.get(user=user, event_type='reveal_debit')
        assert ledger.amount == -1
        assert ledger.pool == 'subscription'
        assert ledger.balance_after == 2
        reveal = Reveal.objects.get(user=user, record_type='people', record_id=str(person.id))
        assert reveal.was_free is False
        user.refresh_from_db()
        assert user.credits_balance == 2

    def test_drawdown_pack_when_subscription_empty(
        self, reveal_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = reveal_session()
        grant(user, 5, pool='pack', event='pack_grant')
        response = client.post(f'/api/reveal/people/{person.id}/')
        assert response.status_code == 200
        assert (
            CreditLedger.objects.get(user=user, event_type='reveal_debit').pool == 'pack'
        )


class TestRevealCompany:
    def test_happy_path_returns_company_contact(
        self, reveal_session: _Session, grant: Callable[..., Any], company: Company
    ) -> None:
        client, user = reveal_session()
        grant(user, 2)
        response = client.post(f'/api/reveal/company/{company.id}/')

        assert response.status_code == 200
        contact = response.json()['contact']
        assert set(contact) == {
            'record_type', 'record_id', 'name', 'industry', 'website',
            'wilaya_code', 'size_band',
        }
        assert contact['record_type'] == 'company'
        assert contact['record_id'] == str(company.id)
        assert contact['name'] == 'ACME Algérie'
        assert contact['website'] == 'https://acme.dz'
        paid = Reveal.objects.get(user=user, record_type='company', record_id=str(company.id))
        assert paid.was_free is False


class TestReRevealIdempotency:
    def test_second_reveal_within_30_days_is_free(
        self, reveal_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = reveal_session()
        grant(user, 3)
        first = client.post(f'/api/reveal/people/{person.id}/')
        second = client.post(f'/api/reveal/people/{person.id}/')

        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()['contact']['email'] == first.json()['contact']['email']
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 1
        assert (
            Reveal.objects.filter(user=user, record_id=str(person.id), was_free=True).count()
            == 1
        )
        user.refresh_from_db()
        assert user.credits_balance == 2
        assert second.json()['balances'] == first.json()['balances']


class TestErrors:
    def test_insufficient_credits_returns_402_and_writes_nothing(
        self, reveal_session: _Session, person: Person
    ) -> None:
        client, user = reveal_session()
        response = client.post(f'/api/reveal/people/{person.id}/')

        assert response.status_code == 402
        assert response.json()['code'] == 'insufficient_credits'
        assert response.json()['detail'] == INSUFFICIENT_CREDITS_MESSAGES['en']
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 0
        assert Reveal.objects.filter(user=user).count() == 0
        user.refresh_from_db()
        assert user.credits_balance == 0

    def test_insufficient_credits_detail_localized(
        self, reveal_session: _Session, person: Person
    ) -> None:
        client, _user = reveal_session(locale='ar')
        response = client.post(f'/api/reveal/people/{person.id}/')
        assert response.status_code == 402
        assert response.json()['detail'] == INSUFFICIENT_CREDITS_MESSAGES['ar']

        client2, _user2 = reveal_session(locale='fr')
        response2 = client2.post(f'/api/reveal/people/{person.id}/')
        assert response2.status_code == 402
        assert response2.json()['detail'] == INSUFFICIENT_CREDITS_MESSAGES['fr']

    def test_record_not_found_returns_404(self, reveal_session: _Session) -> None:
        client, user = reveal_session()
        response = client.post(f'/api/reveal/people/{uuid.uuid4()}/')
        assert response.status_code == 404
        assert response.json()['code'] == 'record_not_found'
        assert CreditLedger.objects.filter(user=user).count() == 0
        assert Reveal.objects.filter(user=user).count() == 0

    def test_unparseable_record_id_returns_404_not_500(
        self, reveal_session: _Session
    ) -> None:
        client, user = reveal_session()
        response = client.post('/api/reveal/people/not-a-uuid/')
        assert response.status_code == 404
        assert response.json()['code'] == 'record_not_found'
        assert CreditLedger.objects.filter(user=user).count() == 0

    def test_invalid_record_type_returns_400(
        self, reveal_session: _Session, person: Person
    ) -> None:
        client, _user = reveal_session()
        response = client.post(f'/api/reveal/fish/{person.id}/')
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_integrity_error_maps_to_409_concurrent_reveal(
        self, reveal_session: _Session, monkeypatch: Any
    ) -> None:
        def _boom(user: Any, record_type: str, record_id: str) -> dict[str, Any]:
            raise IntegrityError('duplicate key value violates unique constraint')

        monkeypatch.setattr('apps.credits.views.reveal_contact', _boom)
        client, _user = reveal_session()
        response = client.post(f'/api/reveal/people/{uuid.uuid4()}/')
        assert response.status_code == 409
        assert response.json()['code'] == 'concurrent_reveal'
        assert response.json()['detail'] == 'Concurrent reveal conflict — please retry.'

    def test_serialization_failure_maps_to_409(
        self, reveal_session: _Session, monkeypatch: Any
    ) -> None:
        def _boom(user: Any, record_type: str, record_id: str) -> dict[str, Any]:
            raise OperationalError('could not serialize access due to concurrent update')

        monkeypatch.setattr('apps.credits.views.reveal_contact', _boom)
        client, _user = reveal_session()
        response = client.post(f'/api/reveal/people/{uuid.uuid4()}/')
        assert response.status_code == 409
        assert response.json()['code'] == 'concurrent_reveal'
