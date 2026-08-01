from datetime import timedelta
from typing import Any, Dict

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone
from rest_framework import status

User = get_user_model()

ME_URL = '/api/auth/me/'


def _verify(user: Any) -> None:
    user.email_verified_at = timezone.now()
    user.save(update_fields=['email_verified_at'])


@pytest.mark.django_db
class TestMeEndpoint:

    def test_me_returns_profile_for_verified_logged_in_user(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        create_user.locale = 'fr'
        create_user.tier = 'starter'
        create_user.credits_balance = 15
        create_user.save(update_fields=['locale', 'tier', 'credits_balance'])
        _verify(create_user)
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == 'test@example.com'
        assert response.data['locale'] == 'fr'
        assert response.data['tier'] == 'starter'
        assert response.data['credits_balance'] == 15
        assert response.data['email_verified_at'] is not None

    def test_me_returns_iso_email_verified_at_for_verified_user(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        _verify(create_user)
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email_verified_at'] == create_user.email_verified_at.isoformat()

    def test_me_returns_401_for_unauthenticated(self, api_client: Client) -> None:
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'not_authenticated'

    def test_me_returns_401_email_not_verified_for_unverified_user(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'email_not_verified'

    def test_me_returns_401_after_password_change(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        _verify(create_user)
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        create_user.set_password('NewPass123!')
        create_user.save()
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'token_not_valid'

    def test_me_returns_401_session_expired_after_31_days_inactivity(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        _verify(create_user)
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        create_user.last_active_at = timezone.now() - timedelta(days=31)
        create_user.save(update_fields=['last_active_at'])
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'session_expired'

    def test_me_returns_401_account_deleted_during_grace_period(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        _verify(create_user)
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        create_user.deletion_scheduled_at = timezone.now()
        create_user.save(update_fields=['deletion_scheduled_at'])
        response = api_client.get(ME_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'account_deleted'
