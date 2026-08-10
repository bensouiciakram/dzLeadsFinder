"""Chargily Pay v2 API client.

Envelope pinned 2026-08-09 (public Chargily Pay v2 documentation):
- checkouts: POST https://pay.chargily.com/api/v2/checkouts
- auth: ``Authorization: Bearer <CHARGILY_API_KEY>``
- currency ``dzd``; payment methods restricted to CIB + EDahabia
- webhook signatures: HMAC-SHA256 hex digest over the RAW request body,
  verified against ``CHARGILY_WEBHOOK_SECRET`` (X-Signature header).

NOTE (5.2 D11 risk): docs.chargily.com was unreachable from the dev
environment at pin time. The envelope is isolated to this module so a
docs-pin correction is a single-file change plus its tests.
"""

import hashlib
import hmac
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

CHECKOUTS_API_URL = 'https://pay.chargily.com/api/v2/checkouts'
TIMEOUT_SECONDS = 10.0


class ChargilyError(Exception):
    """Raised when the Chargily API call fails (network, HTTP, or bad payload)."""


@dataclass(frozen=True)
class CheckoutDetails:
    checkout_url: str
    checkout_id: str


def _create_checkout(plan_data: Dict[str, Any]) -> Dict[str, str]:
    headers = {
        'Authorization': f'Bearer {settings.CHARGILY_API_KEY}',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
    payload: Dict[str, Any] = {
        'amount': plan_data['amount'],
        'currency': 'dzd',
        'payment_methods': ['cib', 'edahabia'],
        'metadata': {
            'user_id': plan_data['user_id'],
            'type': plan_data['type'],
            'amount': plan_data['amount'],
        },
        'success_url': settings.CHARGILY_SUCCESS_URL,
        'failure_url': settings.CHARGILY_FAILURE_URL,
    }
    # The hosted checkout renders the payload description (5.3 AC clause 1 —
    # "DZLeads Starter — 200 credits/mo"). Only subscriptions carry one in
    # 5.3 (5.2 D11 envelope risk rides the isolated adapter).
    description = plan_data.get('description')
    if description:
        payload['description'] = description
    try:
        response = requests.post(
            CHECKOUTS_API_URL, headers=headers, json=payload, timeout=TIMEOUT_SECONDS
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ChargilyError(f'Chargily checkout request failed: {exc}') from exc
    try:
        data = response.json()
    except (ValueError, TypeError) as exc:
        raise ChargilyError('Chargily response is not valid JSON') from exc
    if not isinstance(data, dict):
        raise ChargilyError('Chargily response has an unexpected shape')
    checkout_url = data.get('checkout_url')
    checkout_id = data.get('id')
    if not isinstance(checkout_url, str) or not checkout_url.strip():
        raise ChargilyError('Chargily response missing checkout_url')
    if not isinstance(checkout_id, str) or not checkout_id.strip():
        raise ChargilyError('Chargily response missing id')
    return {'checkout_url': checkout_url, 'checkout_id': checkout_id}


def create_checkout(plan_data: Dict[str, Any]) -> str:
    """Create a Chargily checkout session and return the redirect URL (AC 5.2).

    ``plan_data`` keys: ``user_id``, ``type`` (``'subscription'`` | ``'pack'``),
    ``amount`` (int, DZD).
    """
    return _create_checkout(plan_data)['checkout_url']


def create_checkout_details(plan_data: Dict[str, Any]) -> CheckoutDetails:
    """Create a Chargily checkout and return the redirect URL + checkout id.

    The 5.6 status-card polling keys on the Chargily checkout id (5.2 D14) —
    the checkout URL may not embed a parseable id, so the id is returned
    explicitly.
    """
    result = _create_checkout(plan_data)
    return CheckoutDetails(
        checkout_url=result['checkout_url'],
        checkout_id=result['checkout_id'],
    )


def verify_webhook_signature(payload: bytes, signature: Optional[str]) -> bool:
    """Verify the Chargily webhook HMAC-SHA256 signature over the raw body."""
    secret = settings.CHARGILY_WEBHOOK_SECRET
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
