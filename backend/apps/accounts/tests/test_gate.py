from typing import Any, Dict

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
class TestVerificationGate:

    def test_unverified_user_blocked_from_protected_api(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login.status_code == status.HTTP_200_OK
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'email_not_verified'

    def test_unverified_user_blocked_with_header_token(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        token = login.cookies['access_token'].value
        api_client.cookies.clear()
        response = api_client.get('/api/health/', HTTP_AUTHORIZATION='JWT ' + token)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.data['code'] == 'email_not_verified'

    def test_verified_user_not_blocked(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        create_user.email_verified_at = timezone.now()
        create_user.save(update_fields=['email_verified_at'])
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login.status_code == status.HTTP_200_OK
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_unverified_user_can_refresh_tokens(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login.status_code == status.HTTP_200_OK
        response = api_client.post('/api/auth/jwt/refresh/')
        assert response.status_code == status.HTTP_200_OK
