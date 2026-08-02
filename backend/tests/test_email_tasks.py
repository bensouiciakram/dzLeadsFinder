from datetime import timedelta
from typing import Any, Dict, Tuple

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone

from apps.accounts.models import SingleUseToken
from config.celery import app
from tasks.email_tasks import (
    check_low_credits,
    send_pack_receipt,
    send_password_reset_email,
    send_payment_receipt,
    send_verification_email,
)

User = get_user_model()


def test_email_tasks_importable() -> None:
    assert callable(send_verification_email)
    assert callable(send_payment_receipt)
    assert callable(send_pack_receipt)
    assert callable(send_password_reset_email)
    assert callable(check_low_credits)


def test_celery_beat_schedule_includes_check_low_credits() -> None:
    schedule = app.conf.beat_schedule
    assert 'check-low-credits-daily' in schedule
    entry = schedule['check-low-credits-daily']
    assert entry['task'] == 'tasks.email_tasks.check_low_credits'
    assert entry['schedule'] is not None


@pytest.mark.django_db
class TestSendVerificationEmail:

    def test_sends_localized_link_with_pending_token(
        self,
        monkeypatch: Any,
        create_user: Any,
    ) -> None:
        token = SingleUseToken.objects.create(
            user=create_user,
            purpose='verify',
            token='email-task-token-value',
            expires_at=timezone.now() + timedelta(hours=24),
        )
        calls: Dict[str, Any] = {}

        def spy(template: str, locale: str, context: Dict[str, Any]) -> Tuple[str, str]:
            calls['template'] = template
            calls['locale'] = locale
            calls['link'] = context['verificationLink']
            return ('<html>verify</html>', 'plain text')

        monkeypatch.setattr('tasks.email_tasks.render_email', spy)
        send_verification_email(create_user.pk)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [create_user.email]
        assert calls['template'] == 'signup_confirm'
        assert calls['locale'] == create_user.locale
        assert calls['link'] == f'http://localhost:3000/verify-email/{token.token}'

    def test_missing_user_logs_and_returns(self, monkeypatch: Any) -> None:
        monkeypatch.setattr('tasks.email_tasks.render_email', lambda *a, **k: ('', ''))
        send_verification_email(999999)
        assert len(mail.outbox) == 0

    def test_no_pending_token_logs_and_returns(
        self,
        monkeypatch: Any,
        create_user: Any,
    ) -> None:
        monkeypatch.setattr('tasks.email_tasks.render_email', lambda *a, **k: ('', ''))
        send_verification_email(create_user.pk)
        assert len(mail.outbox) == 0


@pytest.mark.django_db
class TestSendPasswordResetEmail:

    def test_sends_reset_link_with_pending_token(
        self,
        monkeypatch: Any,
        create_user: Any,
    ) -> None:
        token = SingleUseToken.objects.create(
            user=create_user,
            purpose='reset',
            token='reset-task-token-value',
            expires_at=timezone.now() + timedelta(hours=1),
        )
        create_user.locale = 'en'
        create_user.save(update_fields=['locale'])
        calls: Dict[str, Any] = {}

        def spy(template: str, locale: str, context: Dict[str, Any]) -> Tuple[str, str]:
            calls['template'] = template
            calls['locale'] = locale
            calls['link'] = context['resetLink']
            return ('<html>reset</html>', 'plain text')

        monkeypatch.setattr('tasks.email_tasks.render_email', spy)
        send_password_reset_email(create_user.pk)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [create_user.email]
        assert calls['template'] == 'password_reset'
        assert calls['locale'] == create_user.locale
        assert calls['link'] == f'http://localhost:3000/password-reset/{token.token}'
        assert 'Reset your password' in mail.outbox[0].subject

    def test_subject_localized_by_user_locale(
        self,
        monkeypatch: Any,
        create_user: Any,
    ) -> None:
        SingleUseToken.objects.create(
            user=create_user,
            purpose='reset',
            token='reset-task-token-value',
            expires_at=timezone.now() + timedelta(hours=1),
        )
        create_user.locale = 'fr'
        create_user.save(update_fields=['locale'])
        monkeypatch.setattr(
            'tasks.email_tasks.render_email',
            lambda *a, **k: ('<html>reset</html>', 'plain text'),
        )
        send_password_reset_email(create_user.pk)
        assert len(mail.outbox) == 1
        assert 'Réinitialisation' in mail.outbox[0].subject

    def test_missing_user_logs_and_returns(self, monkeypatch: Any) -> None:
        monkeypatch.setattr('tasks.email_tasks.render_email', lambda *a, **k: ('', ''))
        send_password_reset_email(999999)
        assert len(mail.outbox) == 0

    def test_no_pending_token_logs_and_returns(
        self,
        monkeypatch: Any,
        create_user: Any,
    ) -> None:
        monkeypatch.setattr('tasks.email_tasks.render_email', lambda *a, **k: ('', ''))
        send_password_reset_email(create_user.pk)
        assert len(mail.outbox) == 0

    def test_expired_token_does_not_send(
        self,
        monkeypatch: Any,
        create_user: Any,
    ) -> None:
        SingleUseToken.objects.create(
            user=create_user,
            purpose='reset',
            token='expired-reset-token',
            expires_at=timezone.now() - timedelta(hours=1),
        )
        monkeypatch.setattr('tasks.email_tasks.render_email', lambda *a, **k: ('', ''))
        send_password_reset_email(create_user.pk)
        assert len(mail.outbox) == 0

    def test_verify_token_is_never_sent_as_reset_link(
        self,
        monkeypatch: Any,
        create_user: Any,
    ) -> None:
        SingleUseToken.objects.create(
            user=create_user,
            purpose='verify',
            token='verify-token-value',
            expires_at=timezone.now() + timedelta(hours=24),
        )
        monkeypatch.setattr('tasks.email_tasks.render_email', lambda *a, **k: ('', ''))
        send_password_reset_email(create_user.pk)
        assert len(mail.outbox) == 0
