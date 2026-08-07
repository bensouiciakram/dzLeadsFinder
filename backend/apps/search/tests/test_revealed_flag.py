"""Search results `revealed` flag: ≤30d EXISTS per row (closes the 3-2 placeholder)."""

import uuid
from datetime import timedelta
from typing import Any, Callable

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.credits.models import Reveal
from apps.search.models import Company, Person

User = get_user_model()

_Session = Callable[..., tuple[Client, Any]]

pytestmark = pytest.mark.django_db


@pytest.fixture
def search_session(api_client: Client) -> _Session:
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


def _reveal(user: Any, record_type: str, record_id: str, *, was_free: bool = False) -> None:
    Reveal.objects.create(
        user=user, record_type=record_type, record_id=record_id, was_free=was_free
    )


class TestPeopleRevealedFlag:
    def test_people_row_is_false_without_a_reveal(self, search_session: _Session) -> None:
        client, _ = search_session()
        Person.objects.create(name='No Reveal', source='test')
        row = client.get('/api/search/people/').json()['results'][0]
        assert row['revealed'] is False

    def test_people_row_is_true_with_a_30_day_reveal(self, search_session: _Session) -> None:
        client, user = search_session()
        person = Person.objects.create(name='Revealed', source='test')
        _reveal(user, 'people', str(person.id))
        row = client.get('/api/search/people/').json()['results'][0]
        assert row['revealed'] is True

    def test_flag_expires_after_31_days(self, search_session: _Session) -> None:
        client, user = search_session()
        person = Person.objects.create(name='Stale', source='test')
        _reveal(user, 'people', str(person.id))
        Reveal.objects.update(created_at=timezone.now() - timedelta(days=30) - timedelta(seconds=1))
        row = client.get('/api/search/people/').json()['results'][0]
        assert row['revealed'] is False

    def test_free_re_reveal_row_still_flags(self, search_session: _Session) -> None:
        client, user = search_session()
        person = Person.objects.create(name='Free Twin', source='test')
        _reveal(user, 'people', str(person.id), was_free=True)
        row = client.get('/api/search/people/').json()['results'][0]
        assert row['revealed'] is True

    def test_reveals_never_leak_across_users(self, search_session: _Session) -> None:
        client, user_a = search_session()
        user_b = User.objects.create_user(
            email=f'{uuid.uuid4().hex}@example.com',
            password='SecurePass123!',
        )
        user_b.email_verified_at = timezone.now()
        user_b.save(update_fields=['email_verified_at'])
        person = Person.objects.create(name='Private', source='test')
        _reveal(user_a, 'people', str(person.id))
        rows = client.get('/api/search/people/').json()['results']
        assert rows[0]['id'] == str(person.id)
        assert rows[0]['revealed'] is True
        other_client = Client()
        other_client.post(
            '/api/auth/login/',
            {'email': user_b.email, 'password': 'SecurePass123!'},
        )
        other_rows = other_client.get('/api/search/people/').json()['results']
        assert other_rows[0]['revealed'] is False

    def test_flag_correct_on_page_2(self, search_session: _Session) -> None:
        client, user = search_session()
        revealed_person = Person.objects.create(name='AAA Revealed', source='test')
        _reveal(user, 'people', str(revealed_person.id))
        for index in range(101, 201):
            Person.objects.create(name=f'Person {index}', source='test')
        page_two = client.get('/api/search/people/?page=2').json()['results']
        assert all(row['revealed'] is False for row in page_two)
        first_page = client.get('/api/search/people/?page=1').json()['results']
        first = next(row for row in first_page if row['id'] == str(revealed_person.id))
        assert first['revealed'] is True


class TestCompanyRevealedFlag:
    def test_company_row_carries_revealed_key(self, search_session: _Session) -> None:
        client, _ = search_session()
        Company.objects.create(name='Plain Co', source='test')
        row = client.get('/api/search/companies/').json()['results'][0]
        assert row['revealed'] is False

    def test_company_row_is_true_with_a_reveal(self, search_session: _Session) -> None:
        client, user = search_session()
        company = Company.objects.create(name='Locked Co', source='test')
        _reveal(user, 'company', str(company.id))
        row = client.get('/api/search/companies/').json()['results'][0]
        assert row['revealed'] is True
