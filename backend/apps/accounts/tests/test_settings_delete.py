from datetime import datetime, timedelta
from typing import Any, Dict

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone
from rest_framework import status

User = get_user_model()

DELETE_URL = '/api/settings/delete/'
UNDELETE_URL = '/api/settings/undelete/'
FROZEN_STATUS_URL = '/api/settings/frozen-status/'
ME_URL = '/api/auth/me/'


def _freeze(user: Any, days_left: int = 7) -> None:
    user.deleted_at = timezone.now()
    user.deletion_scheduled_at = timezone.now() + timedelta(days=days_left)
    user.save(update_fields=['deleted_at', 'deletion_scheduled_at'])


def _verify(user: Any) -> None:
    user.email_verified_at = timezone.now()
    user.save(update_fields=['email_verified_at'])


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value)


@pytest.mark.django_db
class TestDeleteEndpoint:

    def test_delete_sets_deleted_at_and_schedule_for_verified_user(
        self,
        logged_in_client: Client,
        create_user: Any,
    ) -> None:
        before = timezone.now()
        response = logged_in_client.post(DELETE_URL)
        assert response.status_code == status.HTTP_200_OK
        create_user.refresh_from_db()
        assert create_user.deleted_at is not None
        assert create_user.deletion_scheduled_at is not None
        assert create_user.deleted_at >= before
        scheduled = _parse_iso(response.data['deletion_scheduled_at'])
        assert abs((scheduled - create_user.deletion_scheduled_at)) < timedelta(seconds=1)
        assert create_user.deletion_scheduled_at - create_user.deleted_at == timedelta(days=7)

    def test_delete_returns_401_account_deleted_for_frozen_user(
        self,
        logged_in_client: Client,
        create_user: Any,
    ) -> None:
        _freeze(create_user, days_left=7)
        response = logged_in_client.post(DELETE_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'account_deleted'
        create_user.refresh_from_db()
        assert create_user.deleted_at is not None

    def test_delete_returns_401_for_unauthenticated(self, api_client: Client) -> None:
        response = api_client.post(DELETE_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_freezes_account_immediately(
        self,
        logged_in_client: Client,
        create_user: Any,
    ) -> None:
        response = logged_in_client.post(DELETE_URL)
        assert response.status_code == status.HTTP_200_OK
        me = logged_in_client.get(ME_URL)
        assert me.status_code == status.HTTP_401_UNAUTHORIZED
        assert me.data['code'] == 'account_deleted'


@pytest.mark.django_db
class TestFrozenStatusEndpoint:

    def test_frozen_status_returns_schedule_and_days_left_for_frozen_user(
        self,
        logged_in_client: Client,
        create_user: Any,
    ) -> None:
        _freeze(create_user, days_left=7)
        response = logged_in_client.get(FROZEN_STATUS_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['days_left'] == 7
        assert response.data['deletion_scheduled_at'] == (
            create_user.deletion_scheduled_at.isoformat()
        )

    def test_frozen_status_returns_zero_days_left_after_schedule_passes(
        self,
        logged_in_client: Client,
        create_user: Any,
    ) -> None:
        _freeze(create_user, days_left=0)
        response = logged_in_client.get(FROZEN_STATUS_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['days_left'] == 0

    def test_frozen_status_returns_404_for_active_user(
        self,
        logged_in_client: Client,
    ) -> None:
        response = logged_in_client.get(FROZEN_STATUS_URL)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['code'] == 'not_frozen'

    def test_frozen_status_returns_401_without_cookie(self, api_client: Client) -> None:
        response = api_client.get(FROZEN_STATUS_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_frozen_status_returns_401_for_invalid_cookie(self, api_client: Client) -> None:
        api_client.cookies['access_token'] = 'not-a-jwt'
        response = api_client.get(FROZEN_STATUS_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'token_not_valid'


@pytest.mark.django_db
class TestUndeleteEndpoint:

    def test_undelete_clears_flags_and_restores_full_access(
        self,
        logged_in_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        _freeze(create_user, days_left=7)
        response = logged_in_client.post(UNDELETE_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['code'] == 'account_recovered'
        create_user.refresh_from_db()
        assert create_user.deleted_at is None
        assert create_user.deletion_scheduled_at is None
        me = logged_in_client.get(ME_URL)
        assert me.status_code == status.HTTP_200_OK

    def test_undelete_returns_409_irreversible_after_grace_expires(
        self,
        logged_in_client: Client,
        create_user: Any,
    ) -> None:
        _freeze(create_user, days_left=0)
        response = logged_in_client.post(UNDELETE_URL)
        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data['code'] == 'irreversible'
        create_user.refresh_from_db()
        assert create_user.deleted_at is not None
        assert create_user.deletion_scheduled_at is not None

    def test_undelete_returns_409_not_frozen_for_active_user(
        self,
        logged_in_client: Client,
    ) -> None:
        response = logged_in_client.post(UNDELETE_URL)
        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data['code'] == 'not_frozen'

    def test_undelete_returns_403_for_inactive_frozen_user(
        self,
        logged_in_client: Client,
        create_user: Any,
    ) -> None:
        _freeze(create_user, days_left=7)
        create_user.is_active = False
        create_user.save(update_fields=['is_active'])
        response = logged_in_client.post(UNDELETE_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data['code'] == 'account_inactive'
        create_user.refresh_from_db()
        assert create_user.deleted_at is not None

    def test_undelete_returns_401_without_cookie(self, api_client: Client) -> None:
        response = api_client.post(UNDELETE_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestHardDeletedUserSession:

    def test_refresh_returns_401_not_500_for_hard_deleted_user(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        _verify(create_user)
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login.status_code == status.HTTP_200_OK
        create_user.delete()
        response = api_client.post('/api/auth/jwt/refresh/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'token_not_valid'
