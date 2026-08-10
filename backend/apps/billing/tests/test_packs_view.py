"""GET /api/billing/packs/ — the 5.5 HTTP surface for the 5.4 pack contract.

Contract (Winston Q1, 2026-08-10): authenticated only; the response serves
the pricing.py table verbatim — the FE never derives prices or unit rates
(5.4 D12)::

    {
      "packs": [
        {
          "amount": 500, "credits": 75,
          "description": "DZLeads Pack — 75 credits, never expires",
          "unit_price": "6.7", "never_expires": true, "best_value": false,
        },
        {
          "amount": 1500, "credits": 250,
          "description": "DZLeads Pack — 250 credits, never expires",
          "unit_price": "6.0", "never_expires": true, "best_value": true,
        },
      ],
      "never_expires": true,
    }

``best_value`` is server-computed as ``amount == max(PACK_PRICES)`` — never a
hardcoded literal in the view (a table change flips the badge by itself).
``unit_price`` ships the exact server string ('6.7'/'6.0') — the FE renders
it verbatim; the '.' is fixed in every locale (AD-8).
"""

from typing import Any

import pytest

pytestmark = pytest.mark.django_db


class TestPacksView:
    def test_requires_authentication(self, api_client: Any) -> None:
        response = api_client.get('/api/billing/packs/')
        assert response.status_code == 401

    def test_serves_the_server_pack_table(
        self, logged_in_client: Any, create_user: Any
    ) -> None:
        response = logged_in_client.get('/api/billing/packs/')
        assert response.status_code == 200
        assert response.data == {
            'packs': [
                {
                    'amount': 500,
                    'credits': 75,
                    'description': 'DZLeads Pack — 75 credits, never expires',
                    'unit_price': '6.7',
                    'never_expires': True,
                    'best_value': False,
                },
                {
                    'amount': 1500,
                    'credits': 250,
                    'description': 'DZLeads Pack — 250 credits, never expires',
                    'unit_price': '6.0',
                    'never_expires': True,
                    'best_value': True,
                },
            ],
            'never_expires': True,
        }

    def test_best_value_follows_the_table(
        self, logged_in_client: Any, create_user: Any, monkeypatch: Any
    ) -> None:
        """best_value is derived from the table — a table change flips it.

        Mutation probe: shrink the pack table to {500: 75}; the badge must
        move to the 500 DZD pack without touching the view's logic. Only
        the view's PACK_PRICES binding is patched — the descriptions/unit
        prices still resolve from the real tables for the surviving amount
        (a table edit that drops an amount the other tables still carry is
        a dev-time 500 alarm, by design — fail-fast on drift).
        """
        from apps.billing import views

        monkeypatch.setattr(views, 'PACK_PRICES', {500: 75})
        response = logged_in_client.get('/api/billing/packs/')
        assert response.status_code == 200
        assert [pack['best_value'] for pack in response.data['packs']] == [True]
