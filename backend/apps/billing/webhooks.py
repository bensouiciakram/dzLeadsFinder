"""Chargily webhook handler (spine layout L532).

5.2 RC-1 (2026-08-09): the Celery task moved to ``apps/billing/tasks.py``
(autodiscovered — no explicit celery.py registration needed); this module
holds only the HTTP view. It is imported via urls.py (app registry ready);
Django model/settings reads are still deferred to runtime for consistency
with the task module.
"""

import json
import logging
import uuid
from typing import Any, Dict, Optional, Tuple

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.billing.chargily import verify_webhook_signature
from apps.billing.tasks import grant_credits

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


def _metadata_dict(payload_data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize Chargily metadata to a dict (manual-review fix 2026-08-11).

    The v2 API stores metadata as a LIST of dicts (SDK ``Checkout.metadata:
    List[dict]`` — confirmed against the live test API round-trip). The
    5.2-era handler read ``metadata`` as a dict, so post-shape-fix webhook
    payloads would lose user_id/type/amount. Merges the list (later keys
    win), passes dicts through, and never raises on junk.
    """
    metadata = payload_data.get('metadata')
    if isinstance(metadata, dict):
        return metadata
    if isinstance(metadata, list):
        merged: Dict[str, Any] = {}
        for item in metadata:
            if isinstance(item, dict):
                merged.update(item)
        return merged
    return {}


def _mapped_type(payload_data: Dict[str, Any]) -> Tuple[str, bool]:
    """Map a checkout.paid event to a transaction type (AC table; 5.2 D11).

    Returns ``(type, ambiguous)`` — ambiguous when the payload carries no
    explicit checkout type and no subscription id: the event maps to
    ``subscription_creation`` with a loud log instead of a 500/drop
    (Winston Q5).
    """
    metadata = _metadata_dict(payload_data)
    checkout_type = metadata.get('type')

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
    metadata = _metadata_dict(payload_data)
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
    """SHAPED metadata — never the raw payload (deferred-work #4, resolved — 5.2 D5).

    ``subscription_id`` (5.3 review P2): the Chargily subscription id carried
    by renewal payloads is persisted onto the subscription row by the grant
    task — it is the recovery key for subscription-keyed payment_failed
    lookups when ``metadata.user_id`` is absent.
    """
    from django.conf import settings

    metadata = _metadata_dict(payload_data)
    subscription_id = payload_data.get('subscription_id')
    subscription = payload_data.get('subscription')
    if subscription_id is None and isinstance(subscription, dict):
        subscription_id = subscription.get('id')
    return {
        'checkout_id': payload_data.get('id'),
        'payment_method': payload_data.get('payment_method'),
        'mode': payload_data.get('mode'),
        'server_mode': settings.CHARGILY_MODE,
        'checkout_type': metadata.get('type'),
        'amount': amount,
        'user_id': user_id_value,
        'subscription_id': subscription_id,
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


def _apply_payment_failed_state(payload_data: Dict[str, Any]) -> None:
    """5.3 (AC clause 4; D16): set the user's ACTIVE subscription to
    'failed_renewal'. Inline single UPDATE (microseconds, no outbound calls —
    the ≤5s guarantee holds); idempotent by predicate (replays match nothing
    → no-op); never 400-loops Chargily. Credits are untouched (usable until
    the next cycle — the 5.3 expiry task enforces the end). No transaction
    row (5.2 D3 — the type CHECK excludes it).

    Review P2/P3 (2026-08-10): when ``metadata.user_id`` is absent, the
    Chargily subscription id (persisted onto the row by the grant task) is
    the fallback lookup key; when the payload names a subscription id, a
    stale retry for a PREVIOUS Chargily subscription cannot flip the fresh
    paid cycle (legacy NULL-id rows are tolerated).
    """
    from django.db.models import Q

    from apps.billing.models import Subscription

    event_id = payload_data.get('id')
    metadata = _metadata_dict(payload_data)
    user_id_value = metadata.get('user_id')
    subscription = payload_data.get('subscription')
    payload_sub_id = payload_data.get('subscription_id')
    if payload_sub_id is None and isinstance(subscription, dict):
        payload_sub_id = subscription.get('id')
    if not isinstance(payload_sub_id, str) or not payload_sub_id.strip():
        payload_sub_id = None

    user = _resolve_user(user_id_value) if user_id_value is not None else None
    if user is None:
        if payload_sub_id is not None:
            matched = (
                Subscription.objects.filter(
                    chargily_subscription_id=payload_sub_id, status='active'
                )
                .select_related('user')
                .first()
            )
            if matched is None or matched.user is None:
                logger.warning(
                    'chargily subscription.payment_failed: no active '
                    'subscription matches subscription id %r (event_id=%s) — '
                    'no state change',
                    payload_sub_id,
                    event_id,
                )
                return
            matched.status = 'failed_renewal'
            matched.save(update_fields=['status'])
            logger.warning(
                'chargily subscription.payment_failed: subscription %s set to '
                'failed_renewal via subscription-id lookup (user %s, '
                'event_id=%s)',
                matched.id,
                matched.user_id,
                event_id,
            )
            return
        logger.error(
            'chargily subscription.payment_failed: no metadata user_id and no '
            'subscription id — failed_renewal state write SKIPPED (event_id=%s)',
            event_id,
        )
        return

    queryset = Subscription.objects.filter(user=user, status='active')
    if payload_sub_id is not None:
        queryset = queryset.filter(
            Q(chargily_subscription_id__isnull=True)
            | Q(chargily_subscription_id=payload_sub_id)
        )
    updated = queryset.update(status='failed_renewal')
    if updated:
        logger.warning(
            'chargily subscription.payment_failed: user %s subscription set '
            'to failed_renewal (event_id=%s)',
            user.pk,
            event_id,
        )
    else:
        logger.info(
            'chargily subscription.payment_failed: no active subscription for '
            'user %s — no state change (event_id=%s)',
            user.pk,
            event_id,
        )


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

    # Manual-review fix (2026-08-11): Chargily's official SDK signs webhooks
    # with HMAC-SHA256 over the raw body keyed by the SECRET key and sends
    # the digest in the `signature` header (chargily-pay-python
    # src/chargily_pay/api.py validate_signature + docs/examples/django.md).
    # The 5.2-era pin assumed `X-Signature` — accept the documented header
    # first, keep the old spelling as a fallback for safety.
    signature = request.headers.get('signature') or request.headers.get('X-Signature')
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
        _apply_payment_failed_state(payload_data)
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

    metadata = _metadata_dict(payload_data)
    user_id_value = metadata.get('user_id')
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
