"""Credit API views: the reveal endpoint and the 90-day ledger read.

The reveal view is a thin adapter over `reveal_contact`: it validates the
record type, calls the atomic service DIRECTLY (never inside an outer
transaction.atomic() — the 4.1 deferred-work SERIALIZABLE-composition
contract), maps the typed exceptions to HTTP, and attaches the confirmed
ledger-derived balances the client reconciles against.

The ledger view is a PURE READ over the audit table: 90-day window,
newest first, 50/page, raw event_type codes (localization is frontend
owned). No transaction, no lock, no write (AD-4 the ledger IS the read
surface).
"""

import re
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, OperationalError
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.credits.messages import (
    CONCURRENT_REVEAL_MESSAGES,
    INSUFFICIENT_CREDITS_MESSAGES,
    RECORD_NOT_FOUND_MESSAGES,
)
from apps.credits.models import CreditLedger
from apps.credits.services import (
    LEDGER_PAGE_SIZE,
    LEDGER_WINDOW_DAYS,
    InsufficientCreditsError,
    RevealRecordNotFoundError,
    reveal_contact,
    user_balances,
)

_LOCALES = frozenset({'ar', 'fr', 'en'})
_RECORD_TYPES = frozenset({'people', 'company'})
# 50m rows in a 90-day window is far beyond any real account; the cap keeps
# the OFFSET arithmetic inside PostgreSQL's signed-64-bit range (a page past
# it would raise OperationalError → 500 instead of the 400 contract).
_MAX_LEDGER_PAGE = 1_000_000
_PAGE_RE = re.compile(r'^[0-9]+$')


def _locale(user: object) -> str:
    locale = getattr(user, 'locale', 'en')
    return locale if locale in _LOCALES else 'en'


def _parse_page(raw: str | None) -> int:
    if raw is None:
        return 1
    # Strict digits-only: Python's int() would silently accept '+5', '1_0'
    # and surrounding whitespace — the contract is a plain positive integer.
    if raw == '' or _PAGE_RE.match(raw) is None:
        raise ValidationError(f'Invalid page: {raw}', code='invalid_page')
    page = int(raw)
    if page < 1 or page > _MAX_LEDGER_PAGE:
        raise ValidationError(f'Invalid page: {raw}', code='invalid_page')
    return page


class CreditsLedgerView(APIView):
    """GET /api/credits/ledger/ — the 90-day credit history (FR-16)."""

    def get(self, request: Request) -> Response:
        try:
            page = _parse_page(request.query_params.get('page'))
        except ValidationError:
            return Response(
                {
                    'detail': 'page must be a positive integer.',
                    'code': 'invalid_payload',
                },
                status=400,
            )
        cutoff = timezone.now() - timedelta(days=LEDGER_WINDOW_DAYS)
        queryset = CreditLedger.objects.filter(
            user_id=request.user.id,
            created_at__gte=cutoff,
        )
        total = queryset.count()
        offset = (page - 1) * LEDGER_PAGE_SIZE
        # The `-id` tie-break makes same-instant rows (batch grants, the 4.1
        # backfill) deterministic across paginated reads — without it, ties
        # on created_at could duplicate or skip rows between page boundaries.
        rows = queryset.order_by('-created_at', '-id')[offset : offset + LEDGER_PAGE_SIZE]
        results = [
            {
                'id': str(row.id),
                'event_type': row.event_type,
                'amount': row.amount,
                'balance_after': row.balance_after,
                'reference_id': row.reference_id,
                'created_at': row.created_at.isoformat(),
            }
            for row in rows
        ]
        return Response(
            {
                'results': results,
                'total': total,
                'page': page,
                'truncated': False,
            }
        )


class RevealView(APIView):
    def post(self, request: Request, record_type: str, record_id: str) -> Response:
        if record_type not in _RECORD_TYPES:
            return Response(
                {
                    'detail': "record_type must be 'people' or 'company'.",
                    'code': 'invalid_payload',
                },
                status=400,
            )
        try:
            contact = reveal_contact(request.user, record_type, record_id)
        except InsufficientCreditsError:
            message = INSUFFICIENT_CREDITS_MESSAGES[_locale(request.user)]
            return Response(
                {'detail': message, 'code': 'insufficient_credits'}, status=402
            )
        except RevealRecordNotFoundError:
            message = RECORD_NOT_FOUND_MESSAGES[_locale(request.user)]
            return Response(
                {'detail': message, 'code': 'record_not_found'}, status=404
            )
        except (IntegrityError, OperationalError):
            # A concurrent reveal won the race (partial-unique-index insert
            # or a PG serialization abort). The atomic block has rolled back
            # — nothing was written here. Retryable: the winner's window row
            # makes the retry hit the free path.
            message = CONCURRENT_REVEAL_MESSAGES[_locale(request.user)]
            return Response({'detail': message, 'code': 'concurrent_reveal'}, status=409)
        balances = user_balances(request.user)
        return Response({'contact': contact, 'balances': balances})
