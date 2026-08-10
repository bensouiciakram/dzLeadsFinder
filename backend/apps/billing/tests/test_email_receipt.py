"""send_payment_receipt — the 5.3 receipt email (AC clause 2.5; 5.3 D13).

The stub in tasks/email_tasks.py (1.8) becomes the real implementation:
fetch txn + user, render via the Next.js render route, localized subject.
"""

from typing import Any

import pytest
from django.core import mail

from apps.billing.models import PaymentTransaction
from tasks.email_tasks import PAYMENT_RECEIPT_SUBJECTS, send_payment_receipt

pytestmark = pytest.mark.django_db


def _txn(user: Any, *, txn_type: str = 'subscription_creation') -> Any:
    return PaymentTransaction.objects.create(
        user=user,
        chargily_event_id=f'evt_{txn_type}_{user.pk}',
        type=txn_type,
        amount_dzd=1500,
        credits_granted=200,
    )


class TestReceiptEmail:
    def test_retry_policy_is_single_email_retry(self) -> None:
        assert send_payment_receipt.max_retries == 1
        assert send_payment_receipt.autoretry_for == (Exception,)

    def test_sends_localized_receipt(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        create_user.locale = 'fr'
        create_user.save(update_fields=['locale'])
        row = _txn(create_user)
        captured: dict[str, Any] = {}
        real_render = __import__(
            'tasks.email_tasks', fromlist=['render_email']
        ).render_email

        def spy(template: str, locale: str, context: dict[str, Any]) -> Any:
            captured['template'] = template
            captured['locale'] = locale
            captured['context'] = context
            return real_render(template, locale, context)

        monkeypatch.setattr('tasks.email_tasks.render_email', spy)
        send_payment_receipt(str(row.id))

        assert captured['template'] == 'payment_receipt'
        assert captured['locale'] == 'fr'
        assert captured['context']['amount'] == 1500
        assert captured['context']['currency'] == 'DZD'
        assert captured['context']['creditsGranted'] == 200
        assert captured['context']['isRenewal'] is False
        assert 'date' in captured['context']
        message = mail.outbox[-1]
        assert message.to == [create_user.email]
        assert message.subject == PAYMENT_RECEIPT_SUBJECTS['fr']['creation']

    def test_renewal_variant_subject(self, create_user: Any) -> None:
        create_user.locale = 'en'
        create_user.save(update_fields=['locale'])
        row = _txn(create_user, txn_type='subscription_renewal')
        send_payment_receipt(str(row.id))
        message = mail.outbox[-1]
        assert message.subject == PAYMENT_RECEIPT_SUBJECTS['en']['renewal']
        assert (
            PAYMENT_RECEIPT_SUBJECTS['en']['renewal']
            != PAYMENT_RECEIPT_SUBJECTS['en']['creation']
        )

    def test_subjects_cover_all_locales(self) -> None:
        for locale in ('ar', 'fr', 'en'):
            assert 'creation' in PAYMENT_RECEIPT_SUBJECTS[locale]
            assert 'renewal' in PAYMENT_RECEIPT_SUBJECTS[locale]
            assert PAYMENT_RECEIPT_SUBJECTS[locale]['creation']
            assert PAYMENT_RECEIPT_SUBJECTS[locale]['renewal']

    def test_unknown_locale_falls_back_to_english(self, create_user: Any) -> None:
        create_user.locale = 'de'
        create_user.save(update_fields=['locale'])
        row = _txn(create_user)
        send_payment_receipt(str(row.id))
        assert mail.outbox[-1].subject == PAYMENT_RECEIPT_SUBJECTS['en']['creation']

    def test_missing_transaction_skipped(self, caplog: Any) -> None:
        with caplog.at_level('WARNING'):
            send_payment_receipt('00000000-0000-0000-0000-000000000000')
        assert mail.outbox == []
        assert 'not found' in caplog.text

    def test_invalid_transaction_id_skipped(self, caplog: Any) -> None:
        with caplog.at_level('WARNING'):
            send_payment_receipt('not-a-uuid')
        assert mail.outbox == []

    def test_anonymised_transaction_skipped(self, caplog: Any) -> None:
        row = PaymentTransaction.objects.create(
            user=None,
            chargily_event_id='evt_ghost_rcpt',
            type='subscription_creation',
            amount_dzd=1500,
            credits_granted=200,
        )
        with caplog.at_level('WARNING'):
            send_payment_receipt(str(row.id))
        assert mail.outbox == []
        assert 'no user' in caplog.text

    def test_deleted_user_skipped(self, caplog: Any) -> None:
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.create_user(
            email='ghost-rcpt@example.com', password='SecurePass123!'
        )
        row = _txn(user)
        user.delete()
        with caplog.at_level('WARNING'):
            send_payment_receipt(str(row.id))
        assert mail.outbox == []
