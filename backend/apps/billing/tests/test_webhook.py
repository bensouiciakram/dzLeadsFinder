import hashlib
import hmac
import json
import uuid
from typing import Any, Dict, Optional

import pytest
from django.conf import settings

from apps.billing.models import PaymentTransaction

pytestmark = pytest.mark.django_db

CHECKOUT_EVENT_ID = 'EVT_123'
NORMALIZED_EVENT_ID = 'evt_123'


def _sign(payload: bytes) -> str:
    return hmac.new(
        settings.CHARGILY_WEBHOOK_SECRET.encode('utf-8'),
        payload,
        hashlib.sha256,
    ).hexdigest()


def _post(
    client: Any,
    payload: Dict[str, Any],
    signature: Optional[str] = None,
    *,
    omit_signature: bool = False,
) -> Any:
    raw = json.dumps(payload).encode('utf-8')
    headers = {}
    if not omit_signature:
        if signature is None:
            signature = _sign(raw)
        headers['HTTP_X_SIGNATURE'] = signature
    return client.post(
        '/api/webhooks/chargily/',
        data=raw,
        content_type='application/json',
        **headers,
    )


def _checkout_paid(
    *,
    event_id: str = CHECKOUT_EVENT_ID,
    metadata_type: Optional[str] = 'subscription',
    user_id: Optional[str] = None,
    amount: Any = 1500,
    subscription_id: Optional[str] = None,
    payment_method: str = 'cib',
    mode: str = 'test',
) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        'id': event_id,
        'amount': amount,
        'currency': 'dzd',
        'payment_method': payment_method,
        'mode': mode,
        'metadata': {
            'user_id': user_id,
            'type': metadata_type,
            'amount': amount,
        },
    }
    if subscription_id is not None:
        data['subscription'] = {'id': subscription_id}
    return {'type': 'checkout.paid', 'data': data}


def _spy_grant_credits(monkeypatch: Any) -> list[Any]:
    calls: list[Any] = []

    def spy(event_id: Any) -> None:
        calls.append(event_id)

    monkeypatch.setattr('apps.billing.webhooks.grant_credits.delay', spy)
    return calls


class TestWebhookSecurity:
    def test_view_is_csrf_exempt(self) -> None:
        from apps.billing import webhooks

        assert webhooks.chargily_webhook.csrf_exempt is True

    def test_invalid_signature_rejected(self, api_client: Any) -> None:
        response = _post(api_client, _checkout_paid(), signature='deadbeef')
        assert response.status_code == 400
        assert PaymentTransaction.objects.count() == 0

    def test_missing_signature_rejected(self, api_client: Any) -> None:
        response = _post(api_client, _checkout_paid(), omit_signature=True)
        assert response.status_code == 400
        assert PaymentTransaction.objects.count() == 0

    def test_tampered_body_rejected(self, api_client: Any) -> None:
        payload = _checkout_paid()
        raw = json.dumps(payload).encode('utf-8')
        signature = _sign(raw)
        tampered = raw + b'x'
        response = api_client.post(
            '/api/webhooks/chargily/',
            data=tampered,
            content_type='application/json',
            HTTP_X_SIGNATURE=signature,
        )
        assert response.status_code == 400
        assert PaymentTransaction.objects.count() == 0


class TestCheckoutPaidEvents:
    def test_subscription_creation_event(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(user_id=str(create_user.pk))
        response = _post(api_client, payload)
        assert response.status_code == 200

        assert calls == [NORMALIZED_EVENT_ID]
        row = PaymentTransaction.objects.get()
        assert row.chargily_event_id == NORMALIZED_EVENT_ID
        assert row.type == 'subscription_creation'
        assert row.amount_dzd == 1500
        assert row.status == 'pending'
        assert row.user == create_user
        assert row.chargily_metadata == {
            'checkout_id': CHECKOUT_EVENT_ID,
            'payment_method': 'cib',
            'mode': 'test',
            'server_mode': 'test',
            'checkout_type': 'subscription',
            'amount': 1500,
            'user_id': str(create_user.pk),
        }

    def test_pack_purchase_event(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(
            metadata_type='pack', user_id=str(create_user.pk), amount=500
        )
        response = _post(api_client, payload)
        assert response.status_code == 200
        assert calls == [NORMALIZED_EVENT_ID]
        row = PaymentTransaction.objects.get()
        assert row.type == 'pack_purchase'
        assert row.amount_dzd == 500

    def test_subscription_renewal_event(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(
            user_id=str(create_user.pk), subscription_id='sub_77'
        )
        response = _post(api_client, payload)
        assert response.status_code == 200
        assert calls == [NORMALIZED_EVENT_ID]
        assert PaymentTransaction.objects.get().type == 'subscription_renewal'

    def test_empty_subscription_id_is_not_a_renewal(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(
            user_id=str(create_user.pk), subscription_id='   '
        )
        response = _post(api_client, payload)
        assert response.status_code == 200
        assert calls == [NORMALIZED_EVENT_ID]
        assert PaymentTransaction.objects.get().type == 'subscription_creation'

    def test_event_type_is_case_insensitive(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(user_id=str(create_user.pk))
        payload['type'] = 'Checkout.Paid'
        response = _post(api_client, payload)
        assert response.status_code == 200
        assert calls == [NORMALIZED_EVENT_ID]
        assert PaymentTransaction.objects.get().type == 'subscription_creation'

    def test_oversized_body_rejected_before_signature(
        self, api_client: Any
    ) -> None:
        big = b'x' * 1_000_001
        response = api_client.post(
            '/api/webhooks/chargily/',
            data=big,
            content_type='application/json',
            HTTP_X_SIGNATURE=_sign(big),
        )
        assert response.status_code == 413
        assert PaymentTransaction.objects.count() == 0

    def test_ambiguous_subscription_event_maps_to_creation(
        self, monkeypatch: Any, api_client: Any, create_user: Any, caplog: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(metadata_type=None, user_id=str(create_user.pk))
        with caplog.at_level('WARNING'):
            response = _post(api_client, payload)
        assert response.status_code == 200
        assert calls == [NORMALIZED_EVENT_ID]
        assert PaymentTransaction.objects.get().type == 'subscription_creation'
        assert NORMALIZED_EVENT_ID in caplog.text

    def test_duplicate_event_id_is_acknowledged_once(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(user_id=str(create_user.pk))
        first = _post(api_client, payload)
        second = _post(api_client, payload)
        assert first.status_code == 200
        assert second.status_code == 200
        assert PaymentTransaction.objects.count() == 1
        assert calls == [NORMALIZED_EVENT_ID]

    def test_replay_with_different_payload_keeps_first_write(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        first = _post(api_client, _checkout_paid(user_id=str(create_user.pk), amount=1500))
        second = _post(api_client, _checkout_paid(user_id=str(create_user.pk), amount=9999))
        assert first.status_code == 200
        assert second.status_code == 200
        assert PaymentTransaction.objects.count() == 1
        assert PaymentTransaction.objects.get().amount_dzd == 1500
        assert calls == [NORMALIZED_EVENT_ID]

    def test_missing_user_row_still_inserted(
        self, monkeypatch: Any, api_client: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        ghost_user_id = str(uuid.uuid4())
        payload = _checkout_paid(user_id=ghost_user_id)
        response = _post(api_client, payload)
        assert response.status_code == 200
        row = PaymentTransaction.objects.get()
        assert row.user_id is None
        assert row.chargily_metadata['user_id'] == ghost_user_id
        assert calls == [NORMALIZED_EVENT_ID]

    def test_glitched_provider_amount_falls_back_to_metadata(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(user_id=str(create_user.pk), amount=0)
        payload['data']['metadata']['amount'] = 1500
        response = _post(api_client, payload)
        assert response.status_code == 200
        row = PaymentTransaction.objects.get()
        assert row.amount_dzd == 1500
        assert row.chargily_metadata['amount'] == 1500
        assert calls == [NORMALIZED_EVENT_ID]

    def test_numeric_user_id_still_resolves(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = _checkout_paid(user_id=str(create_user.pk))
        payload['data']['metadata']['user_id'] = int(str(create_user.pk))
        response = _post(api_client, payload)
        assert response.status_code == 200
        assert PaymentTransaction.objects.get().user == create_user
        assert calls == [NORMALIZED_EVENT_ID]

    def test_user_vanishing_before_insert_falls_back_to_null_user(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        from django.db import IntegrityError

        import apps.billing.webhooks as webhooks

        calls = _spy_grant_credits(monkeypatch)
        real_insert = webhooks._insert_transaction
        state = {'raised': False}

        def flaky(
            event_id: Any,
            user_id: Any,
            mapped_type: Any,
            amount: Any,
            shaped: Any,
        ) -> Any:
            if user_id is not None and not state['raised']:
                state['raised'] = True
                raise IntegrityError('FK violation: user deleted')
            return real_insert(event_id, None, mapped_type, amount, shaped)

        monkeypatch.setattr('apps.billing.webhooks._insert_transaction', flaky)
        response = _post(
            api_client, _checkout_paid(user_id=str(create_user.pk))
        )
        assert response.status_code == 200
        row = PaymentTransaction.objects.get()
        assert row.user_id is None
        assert calls == [NORMALIZED_EVENT_ID]

    def test_no_outbound_network_in_request_path(
        self, monkeypatch: Any, api_client: Any, create_user: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)

        def boom(*args: Any, **kwargs: Any) -> None:
            raise AssertionError('network call made from the webhook path')

        monkeypatch.setattr('requests.post', boom)
        response = _post(api_client, _checkout_paid(user_id=str(create_user.pk)))
        assert response.status_code == 200
        assert calls == [NORMALIZED_EVENT_ID]


class TestEventIdValidation:
    def test_missing_event_id_rejected(self, api_client: Any) -> None:
        payload = {'type': 'checkout.paid', 'data': {'amount': 1500, 'metadata': {}}}
        response = _post(api_client, payload)
        assert response.status_code == 400
        assert PaymentTransaction.objects.count() == 0

    def test_malformed_json_rejected(self, api_client: Any) -> None:
        raw = b'this is not json'
        response = api_client.post(
            '/api/webhooks/chargily/',
            data=raw,
            content_type='application/json',
            HTTP_X_SIGNATURE=_sign(raw),
        )
        assert response.status_code == 400
        assert PaymentTransaction.objects.count() == 0


class TestAmountValidation:
    def test_invalid_amount_rejected(self, api_client: Any, create_user: Any) -> None:
        payload = _checkout_paid(user_id=str(create_user.pk), amount='1500')
        response = _post(api_client, payload)
        assert response.status_code == 400
        assert PaymentTransaction.objects.count() == 0

    def test_zero_amount_rejected(self, api_client: Any, create_user: Any) -> None:
        payload = _checkout_paid(user_id=str(create_user.pk), amount=0)
        response = _post(api_client, payload)
        assert response.status_code == 400
        assert PaymentTransaction.objects.count() == 0

    def test_oversized_amount_rejected(self, api_client: Any, create_user: Any) -> None:
        payload = _checkout_paid(user_id=str(create_user.pk), amount=2147483648)
        response = _post(api_client, payload)
        assert response.status_code == 400
        assert PaymentTransaction.objects.count() == 0


class TestNonGrantEvents:
    def test_payment_failed_is_acknowledged_without_row(
        self, monkeypatch: Any, api_client: Any, caplog: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = {
            'type': 'subscription.payment_failed',
            'data': {'subscription': {'id': 'sub_42'}, 'id': 'evt_failed_1'},
        }
        with caplog.at_level('INFO'):
            response = _post(api_client, payload)
        assert response.status_code == 200
        assert PaymentTransaction.objects.count() == 0
        assert calls == []
        assert 'subscription.payment_failed' in caplog.text
        assert 'evt_failed_1' in caplog.text

    def test_payment_failed_without_event_id_is_acked(
        self, monkeypatch: Any, api_client: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = {
            'type': 'subscription.payment_failed',
            'data': {'subscription': {'id': 'sub_42'}},
        }
        response = _post(api_client, payload)
        assert response.status_code == 200
        assert PaymentTransaction.objects.count() == 0
        assert calls == []

    def test_unknown_event_type_is_acknowledged_without_row(
        self, monkeypatch: Any, api_client: Any
    ) -> None:
        calls = _spy_grant_credits(monkeypatch)
        payload = {'type': 'future.event', 'data': {'id': 'evt_unknown'}}
        response = _post(api_client, payload)
        assert response.status_code == 200
        assert PaymentTransaction.objects.count() == 0
        assert calls == []
