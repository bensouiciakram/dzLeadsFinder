from datetime import timedelta
from typing import Any, Dict, cast
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import SingleUseToken

User = get_user_model()

LOGIN_URL = '/api/auth/login/'
SIGNUP_URL = '/api/auth/signup/'
RESEND_URL = '/api/auth/resend-verification/'


def _verify(user: Any) -> None:
    user.email_verified_at = timezone.now()
    user.save(update_fields=['email_verified_at'])


def _make_verify_token(user: Any) -> SingleUseToken:
    return cast(
        SingleUseToken,
        SingleUseToken.objects.create(
            user=user,
            purpose='verify',
            token='verify-token-' + str(uuid4()),
            expires_at=timezone.now() + timedelta(hours=24),
        ),
    )


def _login_as(api_client: Client, email: str, password: str) -> None:
    response = api_client.post(LOGIN_URL, {'email': email, 'password': password})
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestPublicEndpointsIgnoreStaleCookie:

    def test_login_succeeds_with_stale_unverified_cookie(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        User.objects.create_user(
            email='stale@example.com', password='StalePass123!', locale='en',
        )
        _login_as(api_client, 'stale@example.com', 'StalePass123!')
        _verify(create_user)
        response = api_client.post(LOGIN_URL, {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'access_token' in response.cookies

    def test_signup_succeeds_with_stale_unverified_cookie(
        self,
        api_client: Client,
    ) -> None:
        User.objects.create_user(
            email='stale@example.com', password='StalePass123!', locale='en',
        )
        _login_as(api_client, 'stale@example.com', 'StalePass123!')
        response = api_client.post(SIGNUP_URL, {
            'email': 'fresh@example.com',
            'password': 'FreshPass123!',
        })
        assert response.status_code == status.HTTP_201_CREATED

    def test_verify_email_succeeds_with_stale_unverified_cookie(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        User.objects.create_user(
            email='stale@example.com', password='StalePass123!', locale='en',
        )
        _login_as(api_client, 'stale@example.com', 'StalePass123!')
        entry = _make_verify_token(create_user)
        response = api_client.get(f'/api/auth/verify-email/{entry.token}/')
        assert response.status_code == status.HTTP_200_OK
        create_user.refresh_from_db()
        assert create_user.email_verified_at is not None

    def test_resend_succeeds_with_stale_unverified_cookie(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        User.objects.create_user(
            email='stale@example.com', password='StalePass123!', locale='en',
        )
        _login_as(api_client, 'stale@example.com', 'StalePass123!')
        response = api_client.post(RESEND_URL, {'email': user_data['email']})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
