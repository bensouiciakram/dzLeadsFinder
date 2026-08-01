from datetime import timedelta
from typing import Any, Dict

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import SingleUseToken

User = get_user_model()

RESEND_URL = '/api/auth/resend-verification/'


@pytest.mark.django_db
class TestResendVerification:

    def test_resend_creates_new_token_and_invalidates_old(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        old = SingleUseToken.objects.create(
            user=create_user,
            purpose='verify',
            token='old-token-value',
            expires_at=timezone.now() + timedelta(hours=24),
        )
        response = api_client.post(RESEND_URL, {'email': user_data['email']})
        assert response.status_code == status.HTTP_200_OK
        old.refresh_from_db()
        assert old.consumed_at is not None
        fresh = SingleUseToken.objects.filter(
            user=create_user, purpose='verify', consumed_at__isnull=True,
        )
        assert fresh.count() == 1
        assert fresh.first() is not None
        assert fresh.first().token != old.token

    def test_resend_sends_email(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        response = api_client.post(RESEND_URL, {'email': user_data['email']})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [user_data['email']]

    def test_resend_unknown_email_returns_200_without_sending(
        self,
        api_client: Client,
    ) -> None:
        response = api_client.post(RESEND_URL, {'email': 'nobody@example.com'})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0
        assert not SingleUseToken.objects.exists()

    def test_resend_for_verified_user_does_not_send(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        create_user.email_verified_at = timezone.now()
        create_user.save(update_fields=['email_verified_at'])
        response = api_client.post(RESEND_URL, {'email': user_data['email']})
        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 0
