"""Credits welcome banner state tests: schema + GET/PUT /api/search/credits-banner/.

Mirrors the 3.7 checklist dismissal contract verbatim: a nullable
`credits_banner_dismissed_at` timestamp on the user, a GET state read,
and a strict PUT accepting exactly `{'dismissed': True}`.
"""

import uuid
from typing import Any, Callable

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import Client
from django.utils import timezone

User = get_user_model()

_Session = Callable[..., tuple[Client, Any]]

pytestmark = pytest.mark.django_db


@pytest.fixture
def banner_session(api_client: Client) -> _Session:
    def _login() -> tuple[Client, Any]:
        email = f'{uuid.uuid4().hex}@example.com'
        user = User.objects.create_user(
            email=email, password='SecurePass123!', locale='en'
        )
        user.email_verified_at = timezone.now()
        user.save(update_fields=['email_verified_at'])
        api_client.post('/api/auth/login/', {'email': email, 'password': 'SecurePass123!'})
        return api_client, user

    return _login


class TestSchema:
    def test_users_table_has_credits_banner_dismissed_at_column(self) -> None:
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(cursor, 'users')
        columns = {column.name: column for column in description}
        assert 'credits_banner_dismissed_at' in columns
        assert columns['credits_banner_dismissed_at'].null_ok

    def test_user_field_is_nullable_datetime(self) -> None:
        from django.db import models

        field = User._meta.get_field('credits_banner_dismissed_at')
        assert isinstance(field, models.DateTimeField)
        assert field.null
        assert field.blank
        assert not field.has_default()

    def test_new_user_has_no_dismissal(self, create_user: Any) -> None:
        assert create_user.credits_banner_dismissed_at is None


class TestGet:
    def test_fresh_user_not_dismissed(self, banner_session: _Session) -> None:
        client, _user = banner_session()
        response = client.get('/api/search/credits-banner/')
        assert response.status_code == 200
        assert response.json() == {'dismissed': False}

    def test_requires_auth(self, api_client: Client) -> None:
        assert api_client.get('/api/search/credits-banner/').status_code == 401


class TestPut:
    def test_dismiss_sets_column_and_returns_state(self, banner_session: _Session) -> None:
        client, user = banner_session()
        response = client.put(
            '/api/search/credits-banner/',
            data={'dismissed': True},
            content_type='application/json',
        )
        assert response.status_code == 200
        assert response.json() == {'dismissed': True}
        user.refresh_from_db()
        assert user.credits_banner_dismissed_at is not None

    def test_dismiss_reflected_in_get(self, banner_session: _Session) -> None:
        client, _user = banner_session()
        client.put(
            '/api/search/credits-banner/',
            data={'dismissed': True},
            content_type='application/json',
        )
        assert client.get('/api/search/credits-banner/').json()['dismissed'] is True

    def test_dismiss_is_idempotent(self, banner_session: _Session) -> None:
        client, _user = banner_session()
        first = client.put(
            '/api/search/credits-banner/',
            data={'dismissed': True},
            content_type='application/json',
        )
        second = client.put(
            '/api/search/credits-banner/',
            data={'dismissed': True},
            content_type='application/json',
        )
        assert first.status_code == 200
        assert second.status_code == 200

    def test_dismiss_false_rejected(self, banner_session: _Session) -> None:
        client, _user = banner_session()
        response = client.put(
            '/api/search/credits-banner/',
            data={'dismissed': False},
            content_type='application/json',
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_numeric_true_rejected(self, banner_session: _Session) -> None:
        client, _user = banner_session()
        response = client.put(
            '/api/search/credits-banner/',
            data={'dismissed': 1},
            content_type='application/json',
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_empty_payload_rejected(self, banner_session: _Session) -> None:
        client, _user = banner_session()
        response = client.put(
            '/api/search/credits-banner/', data={}, content_type='application/json'
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_unknown_fields_rejected(self, banner_session: _Session) -> None:
        client, _user = banner_session()
        response = client.put(
            '/api/search/credits-banner/',
            data={'dismissed': True, 'extra': 1},
            content_type='application/json',
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_requires_auth(self, api_client: Client) -> None:
        response = api_client.put(
            '/api/search/credits-banner/',
            data={'dismissed': True},
            content_type='application/json',
        )
        assert response.status_code == 401
