import logging
from typing import Any, Dict, Tuple

import requests
from celery import shared_task

logger = logging.getLogger(__name__)

NEXTJS_INTERNAL_URL = 'http://nextjs:3000'


def render_email(template: str, locale: str, context: Dict[str, Any]) -> Tuple[str, str]:
    response = requests.post(
        f'{NEXTJS_INTERNAL_URL}/api/emails/render',
        json={'template': template, 'locale': locale, 'context': context},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data['html'], data.get('plainText', '')


@shared_task  # type: ignore[misc]
def send_verification_email(user_id: int) -> None:
    """Send verification email after signup.

    TODO: Story 2.x — fetch user by user_id, build context, render, send.
    """
    logger.info('send_verification_email called for user_id=%s (not yet implemented)', user_id)


@shared_task  # type: ignore[misc]
def send_payment_receipt(txn_id: str) -> None:
    """Send payment receipt after successful payment.

    TODO: Story 5.x — fetch transaction + user, build context, render, send.
    """
    logger.info('send_payment_receipt called for txn_id=%s (not yet implemented)', txn_id)


@shared_task  # type: ignore[misc]
def send_pack_receipt(txn_id: str) -> None:
    """Send pack receipt after credit pack purchase.

    TODO: Story 5.x — fetch transaction + user, build context, render, send.
    """
    logger.info('send_pack_receipt called for txn_id=%s (not yet implemented)', txn_id)


@shared_task  # type: ignore[misc]
def check_low_credits() -> None:
    """Daily check — warn users with low credit balance.

    TODO: Story 4.x — query users with low balance, send warning email.
    """
    logger.info('check_low_credits called (not yet implemented)')
