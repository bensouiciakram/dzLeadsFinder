import hashlib
import hmac
from typing import Any, Dict

import pytest
from django.conf import settings

from apps.billing.chargily import (
    ChargilyError,
    create_checkout,
    create_checkout_details,
    verify_webhook_signature,
)

CHECKOUTS_API_URL = 'https://pay.chargily.com/api/v2/checkouts'


def _sign(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()


class TestCreateCheckout:
    def test_posts_expected_request(self, monkeypatch: Any) -> None:
        captured: Dict[str, Any] = {}

        class FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> Dict[str, str]:
                return {
                    'id': 'checkout_123',
                    'checkout_url': 'https://pay.chargily.com/checkout/abc',
                }

        def fake_post(url: str, **kwargs: Any) -> FakeResponse:
            captured['url'] = url
            captured['kwargs'] = kwargs
            return FakeResponse()

        monkeypatch.setattr('apps.billing.chargily.requests.post', fake_post)
        checkout_url = create_checkout(
            {'user_id': 42, 'type': 'subscription', 'amount': 1500}
        )

        assert checkout_url == 'https://pay.chargily.com/checkout/abc'
        assert captured['url'] == CHECKOUTS_API_URL
        headers = captured['kwargs']['headers']
        assert headers['Authorization'] == f'Bearer {settings.CHARGILY_API_KEY}'
        assert headers['Accept'] == 'application/json'
        body = captured['kwargs']['json']
        assert body['amount'] == 1500
        assert body['currency'] == 'dzd'
        assert body['payment_methods'] == ['cib', 'edahabia']
        assert body['metadata'] == {
            'user_id': 42,
            'type': 'subscription',
            'amount': 1500,
        }
        assert body['success_url'] == settings.CHARGILY_SUCCESS_URL
        assert body['failure_url'] == settings.CHARGILY_FAILURE_URL
        assert captured['kwargs']['timeout'] > 0

    def test_pack_checkout_uses_pack_type(self, monkeypatch: Any) -> None:
        captured: Dict[str, Any] = {}

        class FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> Dict[str, str]:
                return {
                    'id': 'checkout_pack',
                    'checkout_url': 'https://pay.chargily.com/checkout/pack',
                }

        def fake_post(url: str, **kwargs: Any) -> FakeResponse:
            captured['kwargs'] = kwargs
            return FakeResponse()

        monkeypatch.setattr('apps.billing.chargily.requests.post', fake_post)
        create_checkout({'user_id': 7, 'type': 'pack', 'amount': 500})
        assert captured['kwargs']['json']['metadata'] == {
            'user_id': 7,
            'type': 'pack',
            'amount': 500,
        }

    def test_raises_on_http_error(self, monkeypatch: Any) -> None:
        import requests

        class FailingResponse:
            def raise_for_status(self) -> None:
                raise requests.exceptions.HTTPError('HTTP 500')

        monkeypatch.setattr(
            'apps.billing.chargily.requests.post', lambda *a, **k: FailingResponse()
        )
        with pytest.raises(ChargilyError):
            create_checkout({'user_id': 42, 'type': 'pack', 'amount': 500})

    def test_raises_on_timeout(self, monkeypatch: Any) -> None:
        import requests

        def boom(*args: Any, **kwargs: Any) -> None:
            raise requests.exceptions.Timeout('timed out')

        monkeypatch.setattr('apps.billing.chargily.requests.post', boom)
        with pytest.raises(ChargilyError):
            create_checkout({'user_id': 42, 'type': 'pack', 'amount': 500})

    def test_raises_when_checkout_url_missing(self, monkeypatch: Any) -> None:
        class NoUrlResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> Dict[str, str]:
                return {'id': 'checkout_missing_url'}

        monkeypatch.setattr(
            'apps.billing.chargily.requests.post', lambda *a, **k: NoUrlResponse()
        )
        with pytest.raises(ChargilyError):
            create_checkout({'user_id': 42, 'type': 'pack', 'amount': 500})

    def test_create_checkout_details_returns_url_and_id(self, monkeypatch: Any) -> None:
        class FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> Dict[str, str]:
                return {
                    'id': 'checkout_42',
                    'checkout_url': 'https://pay.chargily.com/checkout/42',
                }

        monkeypatch.setattr(
            'apps.billing.chargily.requests.post', lambda *a, **k: FakeResponse()
        )
        details = create_checkout_details(
            {'user_id': 42, 'type': 'subscription', 'amount': 1500}
        )
        assert details.checkout_url == 'https://pay.chargily.com/checkout/42'
        assert details.checkout_id == 'checkout_42'


class TestVerifyWebhookSignature:
    def test_valid_signature(self) -> None:
        payload = b'{"type": "checkout.paid", "data": {"id": "evt_1"}}'
        signature = _sign(payload, settings.CHARGILY_WEBHOOK_SECRET)
        assert verify_webhook_signature(payload, signature) is True

    def test_tampered_payload_is_rejected(self) -> None:
        payload = b'{"type": "checkout.paid", "data": {"id": "evt_1"}}'
        signature = _sign(payload, settings.CHARGILY_WEBHOOK_SECRET)
        assert verify_webhook_signature(payload + b'x', signature) is False

    def test_wrong_secret_is_rejected(self) -> None:
        payload = b'{"type": "checkout.paid"}'
        signature = _sign(payload, 'some-other-secret')
        assert verify_webhook_signature(payload, signature) is False

    def test_empty_signature_is_rejected(self) -> None:
        payload = b'{"type": "checkout.paid"}'
        assert verify_webhook_signature(payload, '') is False

    def test_none_signature_is_rejected(self) -> None:
        payload = b'{"type": "checkout.paid"}'
        assert verify_webhook_signature(payload, None) is False

    def test_case_changed_signature_is_rejected(self) -> None:
        payload = b'{"type": "checkout.paid"}'
        signature = _sign(payload, settings.CHARGILY_WEBHOOK_SECRET)
        assert verify_webhook_signature(payload, signature.upper()) is False
