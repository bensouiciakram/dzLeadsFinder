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
    send_payment_receipt,
    send_verification_email,
)

User = get_user_model()


def test_email_tasks_importable() -> None:
    assert callable(send_verification_email)
    assert callable(send_payment_receipt)
    assert callable(send_pack_receipt)
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
