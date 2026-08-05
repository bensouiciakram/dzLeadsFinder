import uuid
from typing import Any, Callable

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.search import search_index
from apps.search.models import Person

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


def _seed_people(count: int) -> None:
    rows = [
        Person(
            name=f'Bulk Person {index:04d}',
            source='test',
            search_normalized=search_index.normalize_search(f'Bulk Person {index:04d}'),
        )
        for index in range(count)
    ]
    Person.objects.bulk_create(rows)


class TestTruncation:
    def test_over_1000_marks_truncated_with_refine_prompt(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _seed_people(1005)
        payload = client.get('/api/search/people/').json()
        assert payload['total'] == 1005
        assert payload['truncated'] is True
        assert payload['refine_prompt'] is not None
        assert len(payload['results']) == 100

    def test_refine_prompt_follows_user_locale(self, search_session: _Session) -> None:
        _seed_people(1005)
        for locale, marker in (('ar', 'قيّد'), ('fr', 'affinez'), ('en', 'refine')):
            client, _ = search_session(locale)
            payload = client.get('/api/search/people/').json()
            assert payload['truncated'] is True
            assert marker.lower() in payload['refine_prompt'].lower()

    def test_under_1000_is_not_truncated(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _seed_people(950)
        payload = client.get('/api/search/people/').json()
        assert payload['total'] == 950
        assert payload['truncated'] is False
        assert payload['refine_prompt'] is None

    def test_page_10_navigable_when_truncated(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _seed_people(1005)
        response = client.get('/api/search/people/', {'page': '10'})
        assert response.status_code == 200
        assert len(response.json()['results']) == 100

    def test_page_11_out_of_range_when_truncated(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _seed_people(1005)
        response = client.get('/api/search/people/', {'page': '11'})
        assert response.status_code == 400
        assert response.json()['code'] == 'page_out_of_range'
