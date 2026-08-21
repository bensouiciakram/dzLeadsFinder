"""send_payment_receipt / send_pack_receipt — the receipt emails (5.3 D13,
5.4 D16). The 1.8-era stubs become the real implementations: fetch txn +
user, render via the Next.js render route, localized subject.
"""

from typing import Any

import pytest
from django.core import mail

from apps.billing.models import PaymentTransaction
from tasks.email_tasks import (
    PACK_RECEIPT_SUBJECTS,
    PAYMENT_RECEIPT_SUBJECTS,
    send_pack_receipt,
    send_payment_receipt,
)

pytestmark = pytest.mark.django_db


def _txn(user: Any, *, txn_type: str = 'subscription_creation') -> Any:
    return PaymentTransaction.objects.create(
        user=user,
        chargily_event_id=f'evt_{txn_type}_{user.pk}',
        type=txn_type,
        amount_dzd=1500,
        status='succeeded',
        credits_granted=200,
    )


def _pack_txn(user: Any, *, amount: int = 500, credits: int = 75) -> Any:
    return PaymentTransaction.objects.create(
        user=user,
        chargily_event_id=f'evt_pack_{amount}_{user.pk}',
        type='pack_purchase',
        amount_dzd=amount,
        status='succeeded',
        credits_granted=credits,
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
            status='succeeded',
            credits_granted=200,
        )
        with caplog.at_level('WARNING'):
            send_payment_receipt(str(row.id))
        assert mail.outbox == []
        assert 'TERMINAL' in caplog.text

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


class TestPackReceiptEmail:
    def test_retry_policy_is_single_email_retry(self) -> None:
        assert send_pack_receipt.max_retries == 1
        assert send_pack_receipt.autoretry_for == (Exception,)

    def test_sends_localized_pack_receipt(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        """5.4 D16: locale-aware pack receipt — render context carries
        isPack and the localized subject matches the pack amount."""
        create_user.locale = 'fr'
        create_user.save(update_fields=['locale'])
        row = _pack_txn(create_user)
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
        send_pack_receipt(str(row.id))

        assert captured['template'] == 'payment_receipt'
        assert captured['locale'] == 'fr'
        assert captured['context']['amount'] == 500
        assert captured['context']['currency'] == 'DZD'
        assert captured['context']['creditsGranted'] == 75
        assert captured['context']['isPack'] is True
        assert 'date' in captured['context']
        message = mail.outbox[-1]
        assert message.to == [create_user.email]
        assert message.subject == PACK_RECEIPT_SUBJECTS['fr'][500]

    def test_250_pack_subject(self, create_user: Any) -> None:
        create_user.locale = 'en'
        create_user.save(update_fields=['locale'])
        row = _pack_txn(create_user, amount=1500, credits=250)
        send_pack_receipt(str(row.id))
        assert mail.outbox[-1].subject == PACK_RECEIPT_SUBJECTS['en'][1500]
        assert '250' in PACK_RECEIPT_SUBJECTS['en'][1500]

    def test_subjects_derive_from_pack_prices(self) -> None:
        # The subject's credit count must come from PACK_PRICES itself — a
        # table change must flow into the copy (the old literal prose could
        # silently disagree with the granted credits).
        from apps.billing.pricing import PACK_PRICES

        for locale in ('ar', 'fr', 'en'):
            for price, credits in PACK_PRICES.items():
                assert str(credits) in PACK_RECEIPT_SUBJECTS[locale][price]

    def test_subjects_cover_all_locales_and_packs(self) -> None:
        from apps.billing.pricing import PACK_PRICES

        for locale in ('ar', 'fr', 'en'):
            for price in PACK_PRICES:
                assert price in PACK_RECEIPT_SUBJECTS[locale]
                assert PACK_RECEIPT_SUBJECTS[locale][price]

    def test_unknown_locale_falls_back_to_english(self, create_user: Any) -> None:
        create_user.locale = 'de'
        create_user.save(update_fields=['locale'])
        row = _pack_txn(create_user)
        send_pack_receipt(str(row.id))
        assert mail.outbox[-1].subject == PACK_RECEIPT_SUBJECTS['en'][500]

    def test_off_table_amount_gets_generic_subject_not_wrong_pack(
        self, create_user: Any, caplog: Any
    ) -> None:
        # An amount outside PACK_PRICES must never borrow another pack's
        # subject (the old [500] fallback lied about the credits) — it gets
        # the amount-free subject and logs an error.
        from tasks.email_tasks import GENERIC_PACK_RECEIPT_SUBJECTS

        create_user.locale = 'en'
        create_user.save(update_fields=['locale'])
        row = _pack_txn(create_user, amount=999, credits=100)
        with caplog.at_level('ERROR'):
            send_pack_receipt(str(row.id))
        assert mail.outbox[-1].subject == GENERIC_PACK_RECEIPT_SUBJECTS['en']
        assert 'not in PACK_PRICES' in caplog.text

    def test_missing_transaction_skipped(self, caplog: Any) -> None:
        with caplog.at_level('WARNING'):
            send_pack_receipt('00000000-0000-0000-0000-000000000000')
        assert mail.outbox == []
        assert 'not found' in caplog.text

    def test_invalid_transaction_id_skipped(self, caplog: Any) -> None:
        with caplog.at_level('WARNING'):
            send_pack_receipt('not-a-uuid')
        assert mail.outbox == []

    def test_anonymised_transaction_skipped(self, caplog: Any) -> None:
        row = PaymentTransaction.objects.create(
            user=None,
            chargily_event_id='evt_pack_ghost_rcpt',
            type='pack_purchase',
            amount_dzd=500,
            status='succeeded',
            credits_granted=75,
        )
        with caplog.at_level('WARNING'):
            send_pack_receipt(str(row.id))
        assert mail.outbox == []
        assert 'TERMINAL' in caplog.text
        row.refresh_from_db()
        assert row.receipt_sent_at is not None

    def test_non_pack_transaction_skipped(self, create_user: Any, caplog: Any) -> None:
        """Defensive guard: send_pack_receipt only serves pack rows (the
        resend sweep dispatches by type — a mis-routed call must not send
        a subscription receipt with pack copy)."""
        row = _txn(create_user)
        with caplog.at_level('WARNING'):
            send_pack_receipt(str(row.id))
        assert mail.outbox == []
        assert 'not a pack' in caplog.text

    def test_pack_receipt_sets_receipt_sent_at(self, create_user: Any) -> None:
        """5.4 D20 (RP2): the marker is the sweep's dedupe key — set before
        the send, present after a successful send."""
        row = _pack_txn(create_user)
        send_pack_receipt(str(row.id))
        row.refresh_from_db()
        assert row.receipt_sent_at is not None


class TestReceiptMarker:
    def test_subscription_receipt_sets_receipt_sent_at(
        self, create_user: Any
    ) -> None:
        row = _txn(create_user)
        send_payment_receipt(str(row.id))
        row.refresh_from_db()
        assert row.receipt_sent_at is not None

    def test_failed_send_leaves_marker_unset(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        """A send that raises must leave receipt_sent_at NULL so the
        autoretry (and the sweep) can rescue it (RP2 — the marker is
        CLEARED on failure, not left set)."""
        row = _pack_txn(create_user)

        def boom(template: str, locale: str, context: dict[str, Any]) -> Any:
            raise RuntimeError('smtp down')

        monkeypatch.setattr('tasks.email_tasks.render_email', boom)
        with pytest.raises(RuntimeError):
            send_pack_receipt(str(row.id))
        row.refresh_from_db()
        assert row.receipt_sent_at is None

    def test_second_run_skips_when_marker_set(
        self, create_user: Any, monkeypatch: Any
    ) -> None:
        """RP2 dedupe: the marker is set BEFORE the send under the row lock —
        a concurrent/re-swept second run sees it and sends nothing (no
        duplicates under queue backlog)."""
        row = _pack_txn(create_user)
        calls: list[Any] = []

        def fake_send(self: object, *args: object, **kwargs: object) -> int:
            calls.append(getattr(self, 'subject', ''))
            return 1

        monkeypatch.setattr('django.core.mail.EmailMultiAlternatives.send', fake_send)
        send_pack_receipt(str(row.id))
        send_pack_receipt(str(row.id))
        assert len(calls) == 1

    def test_non_succeeded_row_gets_no_receipt(
        self, create_user: Any, caplog: Any
    ) -> None:
        """RP7 status guard: a refunded/failed row must never receive a
        receipt (latent until the 5.5 refunded path — the guard is the
        contract now)."""
        row = _pack_txn(create_user)
        PaymentTransaction.objects.filter(pk=row.pk).update(status='failed')
        with caplog.at_level('WARNING'):
            send_pack_receipt(str(row.id))
        assert mail.outbox == []
        assert 'status=failed' in caplog.text

    def test_wrong_type_skip_is_terminal(self, create_user: Any, caplog: Any) -> None:
        """RP4: a mis-routed receipt call marks the row receipted — the
        sweep stops re-enqueueing it hourly (the 5.3 P5 lesson)."""
        row = _txn(create_user)
        with caplog.at_level('WARNING'):
            send_pack_receipt(str(row.id))
        assert mail.outbox == []
        row.refresh_from_db()
        assert row.receipt_sent_at is not None

    def test_anonymised_subscription_receipt_is_terminal(
        self, caplog: Any
    ) -> None:
        row = PaymentTransaction.objects.create(
            user=None,
            chargily_event_id='evt_sub_ghost_rcpt',
            type='subscription_creation',
            amount_dzd=1500,
            status='succeeded',
            credits_granted=200,
        )
        with caplog.at_level('WARNING'):
            send_payment_receipt(str(row.id))
        assert mail.outbox == []
        row.refresh_from_db()
        assert row.receipt_sent_at is not None
