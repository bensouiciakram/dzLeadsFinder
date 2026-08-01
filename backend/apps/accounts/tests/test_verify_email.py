from datetime import timedelta
from typing import Any, cast
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import SingleUseToken

User = get_user_model()


def _make_token(user: Any, expires_in: timedelta = timedelta(hours=24)) -> SingleUseToken:
    return cast(
        SingleUseToken,
        SingleUseToken.objects.create(
            user=user,
            purpose='verify',
            token='test-token-' + str(uuid4()),
            expires_at=timezone.now() + expires_in,
        ),
    )


def _verify(client: Client, token: str) -> Any:
    return client.get(f'/api/auth/verify-email/{token}/')


@pytest.mark.django_db
class TestVerifyEmail:

    def test_verify_marks_verified_and_grants_15(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_token(create_user)
        response = _verify(api_client, entry.token)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['code'] == 'verified'
        create_user.refresh_from_db()
        assert create_user.email_verified_at is not None
        assert create_user.credits_balance == 15

    def test_verify_replay_does_not_double_grant(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_token(create_user)
        first = _verify(api_client, entry.token)
        assert first.status_code == status.HTTP_200_OK
        second = _verify(api_client, entry.token)
        assert second.status_code == status.HTTP_200_OK
        assert second.data['code'] == 'already_verified'
        create_user.refresh_from_db()
        assert create_user.credits_balance == 15

    def test_verify_consumed_unverified_token_returns_used(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_token(create_user)
        entry.consumed_at = timezone.now()
        entry.save(update_fields=['consumed_at'])
        response = _verify(api_client, entry.token)
        assert response.status_code == status.HTTP_410_GONE
        assert response.data['code'] == 'token_used'

    def test_verify_marks_token_consumed(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_token(create_user)
        _verify(api_client, entry.token)
        entry.refresh_from_db()
        assert entry.consumed_at is not None

    def test_verify_expired_token_rejected(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_token(create_user, expires_in=timedelta(hours=-1))
        response = _verify(api_client, entry.token)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['code'] == 'token_expired'
        create_user.refresh_from_db()
        assert create_user.email_verified_at is None
        assert create_user.credits_balance == 0

    def test_verify_unknown_token_returns_404(self, api_client: Client) -> None:
        response = _verify(api_client, 'does-not-exist')
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['code'] == 'token_not_found'

    def test_verify_does_not_double_grant_across_tokens(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        first = _make_token(create_user)
        second = _make_token(create_user)
        _verify(api_client, first.token)
        response = _verify(api_client, second.token)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['code'] == 'already_verified'
        create_user.refresh_from_db()
        assert create_user.credits_balance == 15
        second.refresh_from_db()
        assert second.consumed_at is not None

    def test_verify_consumed_token_with_verified_user_returns_already_verified(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_token(create_user)
        create_user.email_verified_at = timezone.now()
        create_user.save(update_fields=['email_verified_at'])
        entry.consumed_at = timezone.now()
        entry.save(update_fields=['consumed_at'])
        response = _verify(api_client, entry.token)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['code'] == 'already_verified'
        create_user.refresh_from_db()
        assert create_user.credits_balance == 0

    def test_verify_soft_deleted_user_returns_404(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_token(create_user)
        create_user.deleted_at = timezone.now()
        create_user.save(update_fields=['deleted_at'])
        response = _verify(api_client, entry.token)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        create_user.refresh_from_db()
        assert create_user.email_verified_at is None
        assert create_user.credits_balance == 0

    def test_verify_then_login_allows_api_access(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        entry = _make_token(create_user)
        response = _verify(api_client, entry.token)
        assert response.status_code == status.HTTP_200_OK
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login.status_code == status.HTTP_200_OK
        health = api_client.get('/api/health/')
        assert health.status_code == status.HTTP_200_OK
