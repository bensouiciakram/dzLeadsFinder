from datetime import timedelta
from typing import Any, cast
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import SingleUseToken

User = get_user_model()

REQUEST_URL = '/api/auth/password-reset/'


def _make_reset_token(
    user: Any,
    expires_in: timedelta = timedelta(hours=1),
    purpose: str = 'reset',
) -> SingleUseToken:
    return cast(
        SingleUseToken,
        SingleUseToken.objects.create(
            user=user,
            purpose=purpose,
            token='reset-token-' + str(uuid4()),
            expires_at=timezone.now() + expires_in,
        ),
    )


def _confirm_url(token: str) -> str:
    return f'/api/auth/password-reset/{token}/'


@pytest.mark.django_db
class TestPasswordResetRequest:

    def test_request_sends_email_and_issues_fresh_one_hour_token(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        old = _make_reset_token(create_user)
        response = api_client.post(REQUEST_URL, {'email': user_data['email']})
        assert response.status_code == status.HTTP_200_OK
        old.refresh_from_db()
        assert old.consumed_at is not None
        fresh = SingleUseToken.objects.filter(
            user=create_user, purpose='reset', consumed_at__isnull=True,
        )
        assert fresh.count() == 1
        token = fresh.first()
        assert token is not None
        assert token.token != old.token
        expiry = token.expires_at - token.created_at
        assert timedelta(hours=1, seconds=-1) <= expiry <= timedelta(hours=1)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [user_data['email']]

    def test_request_unknown_email_returns_200_without_sending(
        self,
        api_client: Client,
    ) -> None:
        response = api_client.post(REQUEST_URL, {'email': 'nobody@example.com'})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0
        assert not SingleUseToken.objects.exists()

    def test_request_soft_deleted_user_does_not_send(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        create_user.deleted_at = timezone.now()
        create_user.save(update_fields=['deleted_at'])
        response = api_client.post(REQUEST_URL, {'email': user_data['email']})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0
        assert not SingleUseToken.objects.filter(user=create_user).exists()

    def test_request_deletion_scheduled_user_does_not_send(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        create_user.deletion_scheduled_at = timezone.now()
        create_user.save(update_fields=['deletion_scheduled_at'])
        response = api_client.post(REQUEST_URL, {'email': user_data['email']})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0

    def test_request_with_non_dict_body_returns_200(
        self,
        api_client: Client,
    ) -> None:
        response = api_client.post(
            REQUEST_URL,
            data='[1, 2]',
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0

    def test_request_case_insensitive_email(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        response = api_client.post(REQUEST_URL, {'email': user_data['email'].upper()})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1

    def test_request_ignores_stale_session_cookie(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        create_user.email_verified_at = timezone.now()
        create_user.save(update_fields=['email_verified_at'])
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login.status_code == status.HTTP_200_OK
        create_user.set_password('ChangedPass123!')
        create_user.save(update_fields=['password', 'token_version'])
        response = api_client.post(REQUEST_URL, {'email': user_data['email']})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1


@pytest.mark.django_db
class TestPasswordResetConfirmGet:

    def test_get_valid_token_returns_200_without_consuming(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user)
        response = api_client.get(_confirm_url(entry.token))
        assert response.status_code == status.HTTP_200_OK
        entry.refresh_from_db()
        assert entry.consumed_at is None

    def test_get_expired_token_returns_400(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user, expires_in=timedelta(hours=-1))
        response = api_client.get(_confirm_url(entry.token))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['code'] == 'token_expired'

    def test_get_used_token_returns_410(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user)
        entry.consumed_at = timezone.now()
        entry.save(update_fields=['consumed_at'])
        response = api_client.get(_confirm_url(entry.token))
        assert response.status_code == status.HTTP_410_GONE
        assert response.data['code'] == 'token_used'

    def test_get_unknown_token_returns_404(
        self,
        api_client: Client,
    ) -> None:
        response = api_client.get(_confirm_url('does-not-exist'))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['code'] == 'token_not_found'

    def test_get_soft_deleted_user_token_returns_404(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user)
        create_user.deleted_at = timezone.now()
        create_user.save(update_fields=['deleted_at'])
        response = api_client.get(_confirm_url(entry.token))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['code'] == 'token_not_found'

    def test_get_ignores_stale_session_cookie(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        create_user.email_verified_at = timezone.now()
        create_user.save(update_fields=['email_verified_at'])
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login.status_code == status.HTTP_200_OK
        create_user.set_password('ChangedPass123!')
        create_user.save(update_fields=['password', 'token_version'])
        entry = _make_reset_token(create_user)
        response = api_client.get(_confirm_url(entry.token))
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestPasswordResetConfirmPost:

    def test_post_sets_new_password_consumes_token_and_bumps_version(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        entry = _make_reset_token(create_user)
        response = api_client.post(
            _confirm_url(entry.token),
            {'password': 'NewSecurePass456!'},
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['code'] == 'password_reset'
        create_user.refresh_from_db()
        assert create_user.check_password('NewSecurePass456!')
        assert not create_user.check_password(user_data['password'])
        assert create_user.token_version == 1
        entry.refresh_from_db()
        assert entry.consumed_at is not None

    def test_post_invalidates_existing_session(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Any,
    ) -> None:
        create_user.email_verified_at = timezone.now()
        create_user.save(update_fields=['email_verified_at'])
        login = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login.status_code == status.HTTP_200_OK
        entry = _make_reset_token(create_user)
        api_client.post(
            _confirm_url(entry.token),
            {'password': 'NewSecurePass456!'},
            content_type='application/json',
        )
        me = api_client.get('/api/auth/me/')
        assert me.status_code == status.HTTP_401_UNAUTHORIZED
        assert me.data['code'] == 'token_not_valid'

    def test_post_rejects_short_password(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user)
        response = api_client.post(
            _confirm_url(entry.token),
            {'password': 'short'},
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        create_user.refresh_from_db()
        assert create_user.token_version == 0
        entry.refresh_from_db()
        assert entry.consumed_at is None

    def test_post_rejects_password_over_128_chars(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user)
        response = api_client.post(
            _confirm_url(entry.token),
            {'password': 'x' * 129},
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        entry.refresh_from_db()
        assert entry.consumed_at is None

    def test_post_replay_returns_410(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user)
        first = api_client.post(
            _confirm_url(entry.token),
            {'password': 'NewSecurePass456!'},
            content_type='application/json',
        )
        assert first.status_code == status.HTTP_200_OK
        second = api_client.post(
            _confirm_url(entry.token),
            {'password': 'AnotherPass789!'},
            content_type='application/json',
        )
        assert second.status_code == status.HTTP_410_GONE
        assert second.data['code'] == 'token_used'

    def test_post_expired_token_returns_400(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user, expires_in=timedelta(hours=-1))
        response = api_client.post(
            _confirm_url(entry.token),
            {'password': 'NewSecurePass456!'},
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['code'] == 'token_expired'
        create_user.refresh_from_db()
        assert not create_user.check_password('NewSecurePass456!')

    def test_post_unknown_token_returns_404(
        self,
        api_client: Client,
    ) -> None:
        response = api_client.post(
            _confirm_url('does-not-exist'),
            {'password': 'NewSecurePass456!'},
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['code'] == 'token_not_found'

    def test_post_non_dict_body_returns_400(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user)
        response = api_client.post(
            _confirm_url(entry.token),
            data='[1, 2]',
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        entry.refresh_from_db()
        assert entry.consumed_at is None

    def test_post_verify_token_is_not_accepted(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        entry = _make_reset_token(create_user, purpose='verify')
        response = api_client.get(_confirm_url(entry.token))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['code'] == 'token_not_found'
