from typing import Any

from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.chargily import ChargilyError, create_checkout_details

PAYMENT_TYPES = frozenset({'subscription', 'pack'})
# PG int4 parity — 5.1 D14 `payments_amount_range_check` upper bound.
MAX_AMOUNT_DZD = 2147483647


def _validation_response(exc: ValidationError) -> Response:
    detail = exc.detail
    message = str(detail[0]) if isinstance(detail, list) else str(detail)
    codes = exc.get_codes()
    code: object = codes[0] if isinstance(codes, list) and len(codes) == 1 else codes
    return Response({'detail': message, 'code': code}, status=400)


class CreateCheckoutView(APIView):
    """POST /api/billing/create-checkout/ — Chargily redirect URL.

    5.2 D6: pure pass-through ({type, amount} validated, NO payment_transactions
    row — the webhook creates the row). The response carries the Chargily
    checkout id so the 5.6 status-card polling has a key (5.2 D14).
    """

    def post(self, request: Request) -> Response:
        data: Any = request.data
        if not isinstance(data, dict):
            return _validation_response(ValidationError('body must be a JSON object'))
        checkout_type = data.get('type')
        amount = data.get('amount')

        if not isinstance(checkout_type, str) or checkout_type not in PAYMENT_TYPES:
            return _validation_response(
                ValidationError('type must be "subscription" or "pack"')
            )
        if isinstance(amount, bool) or not isinstance(amount, int):
            return _validation_response(ValidationError('amount must be an integer (DZD)'))
        if amount < 1 or amount > MAX_AMOUNT_DZD:
            return _validation_response(
                ValidationError('amount out of range (1..2147483647 DZD)')
            )

        try:
            details = create_checkout_details(
                {
                    'user_id': str(request.user.pk),
                    'type': checkout_type,
                    'amount': amount,
                }
            )
        except ChargilyError:
            return Response(
                {
                    'detail': 'Chargily checkout unavailable',
                    'code': 'chargily_unavailable',
                },
                status=502,
            )
        return Response(
            {'checkout_url': details.checkout_url, 'checkout_id': details.checkout_id}
        )
