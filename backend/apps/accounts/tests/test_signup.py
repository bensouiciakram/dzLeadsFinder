from typing import Any, Dict

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import SingleUseToken

User = get_user_model()

SIGNUP_URL = '/api/auth/signup/'


def _post_signup(
    client: Client,
    email: str = 'newuser@example.com',
    password: str = 'SecurePass123!',
    **extra: str,
) -> Any:
    payload: Dict[str, str] = {'email': email, 'password': password}
    payload.update(extra)
    return client.post(SIGNUP_URL, payload)


@pytest.mark.django_db
class TestSignup:

    def test_signup_creates_user_with_free_defaults(self, api_client: Client) -> None:
        response = _post_signup(api_client)
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email='newuser@example.com')
        assert user.tier == 'free'
        assert user.credits_balance == 0
        assert user.email_verified_at is None
        assert user.is_active is True

    def test_signup_lowercases_email(self, api_client: Client) -> None:
        response = _post_signup(api_client, email='Mixed@Example.COM')
        assert response.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(email='mixed@example.com').exists()

    def test_signup_rejects_duplicate_email(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        response = _post_signup(api_client, email=user_data['email'])
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.data
        assert response.data['code']['email'] == ['email_taken']

    def test_signup_rejects_password_over_128_chars(self, api_client: Client) -> None:
        response = _post_signup(api_client, password='x' * 129)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data

    def test_signup_rejects_invalid_email(self, api_client: Client) -> None:
        response = _post_signup(api_client, email='not-an-email')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.data

    def test_signup_rejects_short_password(self, api_client: Client) -> None:
        response = _post_signup(api_client, password='short')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data

    def test_signup_ignores_card_fields(self, api_client: Client) -> None:
        response = _post_signup(
            api_client,
            card_number='4242424242424242',
            card_cvv='123',
            card_expiry='12/29',
            tier='starter',
        )
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email='newuser@example.com')
        assert user.tier == 'free'
        assert user.credits_balance == 0

    def test_signup_creates_single_use_verify_token(self, api_client: Client) -> None:
        response = _post_signup(api_client)
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email='newuser@example.com')
        token = SingleUseToken.objects.get(user=user, purpose='verify')
        assert token.expires_at > timezone.now()
        assert token.consumed_at is None
        assert len(token.token) >= 32

    def test_signup_sends_verification_email(self, api_client: Client) -> None:
        response = _post_signup(api_client)
        assert response.status_code == status.HTTP_201_CREATED
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.to == ['newuser@example.com']
        assert 'Verify your email' in message.subject
        assert len(message.alternatives) == 1

    def test_signup_sets_locale_from_cookie(self, api_client: Client) -> None:
        api_client.cookies['x-locale'] = 'fr'
        response = _post_signup(api_client)
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email='newuser@example.com')
        assert user.locale == 'fr'

    def test_signup_sets_default_locale_when_cookie_invalid(self, api_client: Client) -> None:
        api_client.cookies['x-locale'] = 'xx'
        response = _post_signup(api_client)
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(email='newuser@example.com')
        assert user.locale == 'ar'
