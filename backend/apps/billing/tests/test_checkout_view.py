from typing import Any

from django.contrib.auth import get_user_model

from apps.billing.chargily import ChargilyError, CheckoutDetails
from apps.billing.models import PaymentTransaction

User = get_user_model()

CHECKOUT_URL = 'https://pay.chargily.com/checkout/abc'
CHECKOUT_ID = 'checkout_abc'


def _mock_client(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        'apps.billing.views.create_checkout_details',
        lambda plan_data: CheckoutDetails(
            checkout_url=CHECKOUT_URL,
            checkout_id=CHECKOUT_ID,
        ),
    )


class TestCreateCheckoutView:
    def test_requires_authentication(self, api_client: Any) -> None:
        response = api_client.post(
            '/api/billing/create-checkout/', {}, content_type='application/json'
        )
        assert response.status_code == 401

    def test_creates_subscription_checkout(
        self,
        monkeypatch: Any,
        logged_in_client: Any,
        create_user: Any,
    ) -> None:
        captured: dict[str, Any] = {}

        def spy(plan_data: Any) -> CheckoutDetails:
            captured['plan_data'] = plan_data
            return CheckoutDetails(checkout_url=CHECKOUT_URL, checkout_id=CHECKOUT_ID)

        monkeypatch.setattr('apps.billing.views.create_checkout_details', spy)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            {'type': 'subscription', 'amount': 1500},
            content_type='application/json',
        )
        assert response.status_code == 200
        assert response.data == {'checkout_url': CHECKOUT_URL, 'checkout_id': CHECKOUT_ID}
        assert captured['plan_data'] == {
            'user_id': str(create_user.pk),
            'type': 'subscription',
            'amount': 1500,
        }

    def test_creates_pack_checkout(self, monkeypatch: Any, logged_in_client: Any) -> None:
        captured: dict[str, Any] = {}

        def spy(plan_data: Any) -> CheckoutDetails:
            captured['plan_data'] = plan_data
            return CheckoutDetails(checkout_url=CHECKOUT_URL, checkout_id=CHECKOUT_ID)

        monkeypatch.setattr('apps.billing.views.create_checkout_details', spy)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            {'type': 'pack', 'amount': 500},
            content_type='application/json',
        )
        assert response.status_code == 200
        assert captured['plan_data']['type'] == 'pack'
        assert captured['plan_data']['amount'] == 500

    def test_rejects_unknown_type(self, monkeypatch: Any, logged_in_client: Any) -> None:
        _mock_client(monkeypatch)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            {'type': 'enterprise', 'amount': 1500},
            content_type='application/json',
        )
        assert response.status_code == 400
        assert response.data['code'] == 'invalid'

    def test_rejects_missing_type(self, monkeypatch: Any, logged_in_client: Any) -> None:
        _mock_client(monkeypatch)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            {'amount': 1500},
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_rejects_non_integer_amount(self, monkeypatch: Any, logged_in_client: Any) -> None:
        _mock_client(monkeypatch)
        for bad in ('1500', 1500.5, True, None):
            response = logged_in_client.post(
                '/api/billing/create-checkout/',
                {'type': 'subscription', 'amount': bad},
                content_type='application/json',
            )
            assert response.status_code == 400, f'amount {bad!r} accepted'

    def test_rejects_zero_and_negative_amount(
        self, monkeypatch: Any, logged_in_client: Any
    ) -> None:
        _mock_client(monkeypatch)
        for bad in (0, -500):
            response = logged_in_client.post(
                '/api/billing/create-checkout/',
                {'type': 'pack', 'amount': bad},
                content_type='application/json',
            )
            assert response.status_code == 400, f'amount {bad} accepted'

    def test_rejects_oversized_amount(self, monkeypatch: Any, logged_in_client: Any) -> None:
        _mock_client(monkeypatch)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            {'type': 'pack', 'amount': 2147483648},
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_rejects_missing_body(self, monkeypatch: Any, logged_in_client: Any) -> None:
        _mock_client(monkeypatch)
        response = logged_in_client.post(
            '/api/billing/create-checkout/', {}, content_type='application/json'
        )
        assert response.status_code == 400

    def test_rejects_array_body(self, monkeypatch: Any, logged_in_client: Any) -> None:
        _mock_client(monkeypatch)
        response = logged_in_client.post(
            '/api/billing/create-checkout/', [1, 2], content_type='application/json'
        )
        assert response.status_code == 400

    def test_rejects_scalar_body(self, monkeypatch: Any, logged_in_client: Any) -> None:
        _mock_client(monkeypatch)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            '"subscription"',
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_rejects_unhashable_type(self, monkeypatch: Any, logged_in_client: Any) -> None:
        _mock_client(monkeypatch)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            {'type': ['subscription'], 'amount': 1500},
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_never_writes_transaction_row(
        self, monkeypatch: Any, logged_in_client: Any
    ) -> None:
        _mock_client(monkeypatch)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            {'type': 'subscription', 'amount': 1500},
            content_type='application/json',
        )
        assert response.status_code == 200
        assert PaymentTransaction.objects.count() == 0

    def test_chargily_failure_returns_502(self, monkeypatch: Any, logged_in_client: Any) -> None:
        def boom(plan_data: Any) -> CheckoutDetails:
            raise ChargilyError('network down')

        monkeypatch.setattr('apps.billing.views.create_checkout_details', boom)
        response = logged_in_client.post(
            '/api/billing/create-checkout/',
            {'type': 'subscription', 'amount': 1500},
            content_type='application/json',
        )
        assert response.status_code == 502
        assert 'checkout_url' not in response.data
