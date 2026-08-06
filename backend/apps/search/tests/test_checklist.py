"""Checklist card state tests: schema + GET/PUT /api/search/checklist/ endpoints."""

import uuid
from datetime import timedelta
from typing import Any, Callable

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import Client
from django.utils import timezone

from apps.search.models import DailyUsage

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


class TestSchema:
    def test_users_table_has_checklist_dismissed_at_column(self) -> None:
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(cursor, 'users')
        columns = {column.name: column for column in description}
        assert 'checklist_dismissed_at' in columns
        column = columns['checklist_dismissed_at']
        assert column.null_ok

    def test_user_field_is_nullable_datetime(self) -> None:
        from django.db import models

        field = User._meta.get_field('checklist_dismissed_at')
        assert isinstance(field, models.DateTimeField)
        assert field.null
        assert field.blank
        assert not field.has_default()

    def test_new_user_has_no_dismissal(self, create_user: Any) -> None:
        assert create_user.checklist_dismissed_at is None


class TestGet:
    def test_fresh_user_all_false(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.get('/api/search/checklist/')
        assert response.status_code == 200
        assert response.json() == {
            'step_search': False,
            'step_reveal': False,
            'step_export': False,
            'dismissed': False,
        }

    def test_step_search_true_after_any_search(self, search_session: _Session) -> None:
        client, user = search_session()
        DailyUsage.objects.create(user=user, date=timezone.localdate(), search_count=1)
        body = client.get('/api/search/checklist/').json()
        assert body['step_search'] is True
        assert body['step_reveal'] is False
        assert body['step_export'] is False

    def test_step_search_is_cumulative_across_days(self, search_session: _Session) -> None:
        """First-ever semantics (John PM2): a YESTERDAY search counts — never today-only."""
        client, user = search_session()
        DailyUsage.objects.create(
            user=user, date=timezone.localdate() - timedelta(days=1), search_count=3
        )
        body = client.get('/api/search/checklist/').json()
        assert body['step_search'] is True

    def test_step_search_false_with_zero_count_row(self, search_session: _Session) -> None:
        client, user = search_session()
        DailyUsage.objects.create(user=user, date=timezone.localdate(), search_count=0)
        body = client.get('/api/search/checklist/').json()
        assert body['step_search'] is False

    def test_reveal_and_export_stay_false_in_37(self, search_session: _Session) -> None:
        """Epic-4 contract: the reveals/exports tables do not exist yet — both stay false."""
        client, user = search_session()
        DailyUsage.objects.create(user=user, date=timezone.localdate(), search_count=1)
        body = client.get('/api/search/checklist/').json()
        assert body['step_reveal'] is False
        assert body['step_export'] is False

    def test_requires_auth(self, api_client: Client) -> None:
        assert api_client.get('/api/search/checklist/').status_code == 401


class TestPut:
    def test_dismiss_sets_column_and_returns_state(self, search_session: _Session) -> None:
        client, user = search_session()
        response = client.put(
            '/api/search/checklist/', data={'dismissed': True},
            content_type='application/json',
        )
        assert response.status_code == 200
        body = response.json()
        assert body['dismissed'] is True
        user.refresh_from_db()
        assert user.checklist_dismissed_at is not None

    def test_dismiss_reflected_in_get(self, search_session: _Session) -> None:
        client, _user = search_session()
        client.put('/api/search/checklist/', data={'dismissed': True},
                   content_type='application/json')
        assert client.get('/api/search/checklist/').json()['dismissed'] is True

    def test_dismiss_is_idempotent(self, search_session: _Session) -> None:
        client, _user = search_session()
        first = client.put(
            '/api/search/checklist/', data={'dismissed': True},
            content_type='application/json',
        )
        second = client.put(
            '/api/search/checklist/', data={'dismissed': True},
            content_type='application/json',
        )
        assert first.status_code == 200
        assert second.status_code == 200

    def test_dismiss_false_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.put(
            '/api/search/checklist/', data={'dismissed': False},
            content_type='application/json',
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_empty_payload_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.put(
            '/api/search/checklist/', data={}, content_type='application/json'
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_unknown_fields_rejected(self, search_session: _Session) -> None:
        client, _user = search_session()
        response = client.put(
            '/api/search/checklist/',
            data={'dismissed': True, 'extra': 1},
            content_type='application/json',
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_requires_auth(self, api_client: Client) -> None:
        response = api_client.put(
            '/api/search/checklist/', data={'dismissed': True},
            content_type='application/json',
        )
        assert response.status_code == 401
