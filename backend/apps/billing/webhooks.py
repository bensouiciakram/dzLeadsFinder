"""Chargily webhook handler + Celery tasks (spine layout L532).

Module-level imports are limited to stdlib + ``django.http`` +
``django.views.decorators.csrf`` + ``celery`` — ``config/celery.py`` imports
this module before the app registry is ready (the ``tasks/email_tasks.py``
precedent, 5.2 D9). All Django model/settings reads are deferred to runtime.
"""

import json
import logging
import uuid
from typing import Any, Dict, Optional, Tuple

from celery import shared_task
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.billing.chargily import verify_webhook_signature

logger = logging.getLogger(__name__)

# PG int4 parity — 5.1 D14 `payments_amount_range_check` upper bound.
MAX_AMOUNT_DZD = 2147483647
# Webhook payloads are small JSON events; the cap bounds the memory read on
# the only public unauthenticated endpoint (5.2 P7 — Django's
# DATA_UPLOAD_MAX_MEMORY_SIZE does NOT bound raw POST bodies).
MAX_WEBHOOK_BYTES = 1_000_000


def _normalize_event_id(event_id: Any) -> Optional[str]:
    """Normalize for the global UNIQUE guard (deferred-work #5, resolved — 5.2 D5)."""
    if not isinstance(event_id, str):
        return None
    normalized = event_id.strip().lower()
    return normalized or None


def _mapped_type(payload_data: Dict[str, Any]) -> Tuple[str, bool]:
    """Map a checkout.paid event to a transaction type (AC table; 5.2 D11).

    Returns ``(type, ambiguous)`` — ambiguous when the payload carries no
    explicit checkout type and no subscription id: the event maps to
    ``subscription_creation`` with a loud log instead of a 500/drop
    (Winston Q5).
    """
    metadata = payload_data.get('metadata')
    checkout_type = metadata.get('type') if isinstance(metadata, dict) else None

    if checkout_type == 'pack':
        return 'pack_purchase', False

    subscription_id = payload_data.get('subscription_id')
    subscription = payload_data.get('subscription')
    if subscription_id is None and isinstance(subscription, dict):
        subscription_id = subscription.get('id')
    if isinstance(subscription_id, str) and subscription_id.strip():
        return 'subscription_renewal', False

    if checkout_type == 'subscription':
        return 'subscription_creation', False
    return 'subscription_creation', True


def _resolve_amount(payload_data: Dict[str, Any]) -> Optional[int]:
    """Provider-confirmed amount preferred; metadata amount is the fallback (5.2 D13)."""
    candidates: list[int] = []
    amount = payload_data.get('amount')
    if isinstance(amount, int) and not isinstance(amount, bool):
        candidates.append(amount)
    metadata = payload_data.get('metadata')
    if isinstance(metadata, dict):
        meta_amount = metadata.get('amount')
        if isinstance(meta_amount, int) and not isinstance(meta_amount, bool):
            candidates.append(meta_amount)
    if not candidates:
        return None
    # Provider-confirmed amount preferred, but a glitched provider value
    # (e.g. out-of-range) must not discard a valid metadata fallback (5.2 P1).
    resolved = next((c for c in candidates if 1 <= c <= MAX_AMOUNT_DZD), None)
    return resolved


def _resolve_user(user_id_value: Any) -> Optional[Any]:
    if user_id_value is None:
        return None
    if not isinstance(user_id_value, str):
        user_id_value = str(user_id_value)
    if not user_id_value:
        return None
    from django.contrib.auth import get_user_model

    try:
        return get_user_model().objects.filter(pk=user_id_value).first()
    except (ValueError, TypeError):
        return None


def _shaped_metadata(
    payload_data: Dict[str, Any], amount: int, user_id_value: Any
) -> Dict[str, Any]:
    """SHAPED metadata — never the raw payload (deferred-work #4, resolved — 5.2 D5)."""
    from django.conf import settings

    metadata = payload_data.get('metadata')
    return {
        'checkout_id': payload_data.get('id'),
        'payment_method': payload_data.get('payment_method'),
        'mode': payload_data.get('mode'),
        'server_mode': settings.CHARGILY_MODE,
        'checkout_type': metadata.get('type') if isinstance(metadata, dict) else None,
        'amount': amount,
        'user_id': user_id_value,
    }


def _insert_transaction(
    event_id: str,
    user_id: Any,
    mapped_type: str,
    amount: int,
    shaped: Dict[str, Any],
) -> Optional[uuid.UUID]:
    """Guarded insert — the AD-5 idempotency guard (spine L620-621).

    Raw SQL ``ON CONFLICT DO NOTHING RETURNING id`` supplies the Python-side
    defaults (``id``/``created_at``/``status``) per 5.1 D6; conflict detected
    via ``fetchone() is None``, never rowcount (5.2 D12).
    """
    from django.db import connection
    from django.utils import timezone

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO payment_transactions
                (id, user_id, chargily_event_id, type, amount_dzd, status,
                 chargily_metadata, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (chargily_event_id) DO NOTHING
            RETURNING id
            """,
            [
                str(uuid.uuid4()),
                user_id,
                event_id,
                mapped_type,
                amount,
                'pending',
                json.dumps(shaped),
                timezone.now(),
            ],
        )
        row = cursor.fetchone()
    return row[0] if row is not None else None


@csrf_exempt  # type: ignore[misc]
def chargily_webhook(request: HttpRequest) -> JsonResponse:
    """POST /api/webhooks/chargily/ — verify, dedupe, enqueue (spine L616-624).

    Returns 200 within 5 seconds: the request path performs no outbound
    network calls (the grant work is the enqueued Celery task).
    """
    from django.db import IntegrityError

    content_length = request.META.get('CONTENT_LENGTH')
    try:
        declared_length = int(content_length) if content_length is not None else 0
    except ValueError:
        declared_length = 0
    if declared_length > MAX_WEBHOOK_BYTES:
        return JsonResponse({'detail': 'payload too large'}, status=413)

    signature = request.headers.get('X-Signature')
    raw_payload = request.body
    if not verify_webhook_signature(raw_payload, signature):
        return JsonResponse({'detail': 'invalid signature'}, status=400)
    try:
        payload = json.loads(raw_payload.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'detail': 'malformed payload'}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({'detail': 'malformed payload'}, status=400)

    event_type = payload.get('type')
    payload_data = payload.get('data')
    if not isinstance(event_type, str) or not isinstance(payload_data, dict):
        return JsonResponse({'detail': 'malformed payload'}, status=400)
    event_type = event_type.lower()

    if event_type == 'subscription.payment_failed':
        logger.info(
            'chargily subscription.payment_failed received: event_id=%s',
            payload_data.get('id'),
        )
        return JsonResponse({'status': 'ok'})

    if event_type != 'checkout.paid':
        logger.info('chargily unknown event type %r received', event_type)
        return JsonResponse({'status': 'ok'})

    event_id = _normalize_event_id(payload_data.get('id'))
    if event_id is None:
        logger.error(
            'chargily checkout.paid rejected: missing event id (data.id=%r)',
            payload_data.get('id'),
        )
        return JsonResponse({'detail': 'missing event id'}, status=400)

    mapped_type, ambiguous = _mapped_type(payload_data)
    if ambiguous:
        logger.warning(
            'chargily checkout.paid without explicit type mapped to '
            'subscription_creation: event_id=%s',
            event_id,
        )
    amount = _resolve_amount(payload_data)
    if amount is None:
        logger.error(
            'chargily checkout.paid rejected: invalid amount (event_id=%s)',
            event_id,
        )
        return JsonResponse({'detail': 'invalid amount'}, status=400)

    metadata = payload_data.get('metadata')
    user_id_value = metadata.get('user_id') if isinstance(metadata, dict) else None
    user = _resolve_user(user_id_value)
    shaped = _shaped_metadata(payload_data, amount, user_id_value)

    try:
        inserted_id = _insert_transaction(
            event_id,
            user.pk if user is not None else None,
            mapped_type,
            amount,
            shaped,
        )
    except IntegrityError:
        # The user vanished between resolve and insert (the daily
        # anonymise+purge task — 5.1 D2): keep the financial row with a NULL
        # user instead of 500-ing Chargily into a retry storm (5.2 P2).
        logger.warning(
            'chargily event %s: user %r vanished before insert — '
            'inserting with user_id NULL',
            event_id,
            user_id_value,
        )
        inserted_id = _insert_transaction(
            event_id, None, mapped_type, amount, shaped
        )
    if inserted_id is None:
        return JsonResponse({'status': 'ok'})

    grant_credits.delay(event_id)
    return JsonResponse({'status': 'ok'})


@shared_task(  # type: ignore[misc]
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True,
)
def grant_credits(event_id: str) -> None:
    """Reconcile a paid Chargily event — bridge in 5.2 (5.2 D7/D15).

    The real grant logic (credit_ledger insert, subscription create/renew,
    receipt email) lands in 5.3. The bridge re-queries the transaction row,
    so the task is idempotent and safe on missing rows. Retry policy per
    AD-14: 3 retries with exponential backoff (payment reconciliation).
    """
    from apps.billing.models import PaymentTransaction

    try:
        row = PaymentTransaction.objects.get(chargily_event_id=event_id)
    except PaymentTransaction.DoesNotExist:
        logger.warning('grant_credits: no transaction row for event_id=%s', event_id)
        return
    if row.user_id is None:
        logger.warning(
            'grant_credits: transaction %s has no user (anonymised) — grant skipped',
            event_id,
        )
        return
    logger.info(
        'grant_credits: event_id=%s recorded (type=%s) — grant logic lands in 5.3',
        event_id,
        row.type,
    )
