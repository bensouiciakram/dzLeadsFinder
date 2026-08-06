"""Saved-search API endpoint tests: create/list/update/delete, caps, user-scoping."""

import uuid
from typing import Any, Callable

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.search.models import DailyUsage, SavedSearch

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


def _payload(*, name: str = 'Importers Oran', search_type: str = 'people') -> dict[str, Any]:
    return {
        'name': name,
        'type': search_type,
        'filters': {'industry': [2], 'wilaya': [31], 'keyword': 'textile'},
        'sort': {'field': 'role', 'dir': 'desc'},
    }


def _seed(client: Client, user: Any, count: int, prefix: str = 'saved') -> list[SavedSearch]:
    rows = [
        SavedSearch.objects.create(
            user=user,
            name=f'{prefix} {index}',
            type='people',
            filters={'industry': [index]},
        )
        for index in range(count)
    ]
    return rows


class TestCreate:
    def test_creates_saved_search(self, search_session: _Session) -> None:
        client, user = search_session()
        response = client.post(
            '/api/search/saved/', data=_payload(), content_type='application/json'
        )
        assert response.status_code == 201
        body = response.json()
        assert body['name'] == 'Importers Oran'
        assert body['type'] == 'people'
        assert body['filters'] == {'industry': [2], 'wilaya': [31], 'keyword': 'textile'}
        assert body['sort'] == {'field': 'role', 'dir': 'desc'}
        assert body['created_at'] is not None
        row = SavedSearch.objects.get(pk=body['id'])
        assert row.user_id == user.id

    def test_filters_round_trip_exactly(self, search_session: _Session) -> None:
        client, _user = search_session()
        payload = _payload()
        response = client.post(
            '/api/search/saved/', data=payload, content_type='application/json'
        )
        assert response.status_code == 201
        assert response.json()['filters'] == payload['filters']

    def test_create_requires_auth(self, api_client: Client) -> None:
        response = api_client.post(
            '/api/search/saved/', data=_payload(), content_type='application/json'
        )
        assert response.status_code in (401, 403)

    def test_blank_name_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.post(
            '/api/search/saved/',
            data=_payload(name='   '),
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_name_too_long_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.post(
            '/api/search/saved/',
            data=_payload(name='n' * 101),
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_bad_type_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.post(
            '/api/search/saved/',
            data=_payload(search_type='companies'),
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_missing_filters_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        payload = _payload()
        del payload['filters']
        response = client.post(
            '/api/search/saved/', data=payload, content_type='application/json'
        )
        assert response.status_code == 400

    def test_non_object_filters_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        payload = _payload()
        payload['filters'] = [1, 2]
        response = client.post(
            '/api/search/saved/', data=payload, content_type='application/json'
        )
        assert response.status_code == 400

    def test_non_object_sort_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        payload = _payload()
        payload['sort'] = 'role:desc'
        response = client.post(
            '/api/search/saved/', data=payload, content_type='application/json'
        )
        assert response.status_code == 400


class TestCaps:
    def test_free_at_cap_is_rejected(self, search_session: _Session) -> None:
        client, user = search_session(tier='free')
        _seed(client, user, 5)
        response = client.post(
            '/api/search/saved/', data=_payload(), content_type='application/json'
        )
        assert response.status_code == 400
        body = response.json()
        assert body['code'] == 'saved_search_limit_exceeded'
        assert body['limit'] == 5
        assert SavedSearch.objects.filter(user=user).count() == 5

    def test_free_below_cap_succeeds(self, search_session: _Session) -> None:
        client, user = search_session(tier='free')
        _seed(client, user, 4)
        response = client.post(
            '/api/search/saved/', data=_payload(), content_type='application/json'
        )
        assert response.status_code == 201

    def test_starter_at_cap_is_rejected(self, search_session: _Session) -> None:
        client, user = search_session(tier='starter')
        _seed(client, user, 25)
        response = client.post(
            '/api/search/saved/', data=_payload(), content_type='application/json'
        )
        assert response.status_code == 400
        assert response.json()['limit'] == 25

    def test_starter_below_cap_succeeds(self, search_session: _Session) -> None:
        client, user = search_session(tier='starter')
        _seed(client, user, 24)
        response = client.post(
            '/api/search/saved/', data=_payload(), content_type='application/json'
        )
        assert response.status_code == 201

    def test_cap_message_localized(self, search_session: _Session) -> None:
        client, user = search_session(locale='fr', tier='free')
        _seed(client, user, 5)
        response = client.post(
            '/api/search/saved/', data=_payload(), content_type='application/json'
        )
        assert response.status_code == 400
        assert '5' in response.json()['detail']


class TestList:
    def test_lists_own_searches_latest_first(self, search_session: _Session) -> None:
        client, user = search_session()
        older = SavedSearch.objects.create(user=user, name='older', type='people')
        _seed(client, user, 1, prefix='newer')
        older.created_at = timezone.now() - timezone.timedelta(minutes=1)
        older.save(update_fields=['created_at'])
        response = client.get('/api/search/saved/')
        assert response.status_code == 200
        names = [row['name'] for row in response.json()]
        assert names == ['newer 0', 'older']

    def test_other_users_searches_absent(self, search_session: _Session) -> None:
        client_a, user_a = search_session()
        _seed(client_a, user_a, 2)
        client_b = Client()
        email = f'{uuid.uuid4().hex}@example.com'
        user_b = User.objects.create_user(
            email=email, password='SecurePass123!', locale='en', tier='free'
        )
        client_b.post('/api/auth/login/', {'email': email, 'password': 'SecurePass123!'})
        _seed(client_b, user_b, 1)
        response = client_a.get('/api/search/saved/')
        rows = response.json()
        assert len(rows) == 2
        assert all(SavedSearch.objects.get(pk=row['id']).user_id == user_a.id for row in rows)

    def test_list_requires_auth(self, api_client: Client) -> None:
        assert api_client.get('/api/search/saved/').status_code in (401, 403)


class TestUpdate:
    def test_rename_does_not_rerun_or_touch_filters(self, search_session: _Session) -> None:
        client, user = search_session()
        row = SavedSearch.objects.create(
            user=user,
            name='old',
            type='people',
            filters={'industry': [2], 'wilaya': [31]},
            sort={'field': 'role', 'dir': 'desc'},
        )
        response = client.put(
            f'/api/search/saved/{row.pk}/',
            data={'name': 'new'},
            content_type='application/json',
        )
        assert response.status_code == 200
        row.refresh_from_db()
        assert row.name == 'new'
        assert row.filters == {'industry': [2], 'wilaya': [31]}
        assert row.sort == {'field': 'role', 'dir': 'desc'}
        assert not DailyUsage.objects.filter(user=user).exists()

    def test_update_filters_and_sort(self, search_session: _Session) -> None:
        client, user = search_session()
        row = SavedSearch.objects.create(user=user, name='x', type='people')
        response = client.put(
            f'/api/search/saved/{row.pk}/',
            data={
                'name': 'y',
                'filters': {'keyword': 'pharma'},
                'sort': {'field': 'name', 'dir': 'asc'},
            },
            content_type='application/json',
        )
        assert response.status_code == 200
        row.refresh_from_db()
        assert row.name == 'y'
        assert row.filters == {'keyword': 'pharma'}
        assert row.sort == {'field': 'name', 'dir': 'asc'}

    def test_update_type_rejected(self, search_session: _Session) -> None:
        client, user = search_session()
        row = SavedSearch.objects.create(user=user, name='x', type='people')
        response = client.put(
            f'/api/search/saved/{row.pk}/',
            data={'type': 'company'},
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_foreign_row_is_404(self, search_session: _Session) -> None:
        client_a, user_a = search_session()
        row = SavedSearch.objects.create(user=user_a, name='mine', type='people')
        client_b, _user_b = search_session()
        response = client_b.put(
            f'/api/search/saved/{row.pk}/',
            data={'name': 'theirs'},
            content_type='application/json',
        )
        assert response.status_code == 404

    def test_unknown_id_is_404(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.put(
            f'/api/search/saved/{uuid.uuid4()}/',
            data={'name': 'x'},
            content_type='application/json',
        )
        assert response.status_code == 404

    def test_malformed_id_is_404(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.put(
            '/api/search/saved/not-a-uuid/', data={'name': 'x'},
            content_type='application/json',
        )
        assert response.status_code in (400, 404)

    def test_update_requires_auth(self, search_session: _Session) -> None:
        client, user = search_session()
        row = SavedSearch.objects.create(user=user, name='x', type='people')
        client.logout()
        response = client.put(
            f'/api/search/saved/{row.pk}/',
            data={'name': 'x2'},
            content_type='application/json',
        )
        assert response.status_code in (401, 403)


class TestDelete:
    def test_delete_removes_row(self, search_session: _Session) -> None:
        client, user = search_session()
        row = SavedSearch.objects.create(user=user, name='x', type='people')
        response = client.delete(f'/api/search/saved/{row.pk}/')
        assert response.status_code == 204
        assert not SavedSearch.objects.filter(pk=row.pk).exists()

    def test_foreign_row_delete_is_404(self, search_session: _Session) -> None:
        client_a, user_a = search_session()
        row = SavedSearch.objects.create(user=user_a, name='mine', type='people')
        client_b, _user_b = search_session()
        assert client_b.delete(f'/api/search/saved/{row.pk}/').status_code == 404

    def test_delete_requires_auth(self, search_session: _Session) -> None:
        client, user = search_session()
        row = SavedSearch.objects.create(user=user, name='x', type='people')
        client.logout()
        assert client.delete(f'/api/search/saved/{row.pk}/').status_code in (401, 403)
