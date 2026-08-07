"""Reveal endpoint: POST /api/reveal/{type}/{id}/ — the 4.2 reveal surface.

The view is a thin adapter over `reveal_contact`: it validates the record
type, calls the atomic service DIRECTLY (never inside an outer
transaction.atomic() — the 4.1 deferred-work SERIALIZABLE-composition
contract), maps the typed exceptions to HTTP, and attaches the confirmed
ledger-derived balances the client reconciles against.
"""

from django.db import IntegrityError, OperationalError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.credits.messages import (
    CONCURRENT_REVEAL_MESSAGES,
    INSUFFICIENT_CREDITS_MESSAGES,
    RECORD_NOT_FOUND_MESSAGES,
)
from apps.credits.services import (
    InsufficientCreditsError,
    RevealRecordNotFoundError,
    reveal_contact,
    user_balances,
)

_LOCALES = frozenset({'ar', 'fr', 'en'})
_RECORD_TYPES = frozenset({'people', 'company'})


def _locale(user: object) -> str:
    locale = getattr(user, 'locale', 'en')
    return locale if locale in _LOCALES else 'en'


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
