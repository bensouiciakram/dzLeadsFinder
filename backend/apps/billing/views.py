from typing import Any

from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.chargily import ChargilyError, create_checkout_details
from apps.billing.pricing import (
    PACK_DESCRIPTIONS,
    PACK_PRICES,
    SUBSCRIPTION_DESCRIPTION,
    SUBSCRIPTION_PRICE_DZD,
)

PAYMENT_TYPES = frozenset({'subscription', 'pack'})
# PG int4 parity — 5.1 D14 `payments_amount_range_check` upper bound.
MAX_AMOUNT_DZD = 2147483647


class PlanView(APIView):
    """GET /api/billing/plan/ — the 5.3 forward contract (5.3 D12).

    ``{tier, status, renews_on}``: tier = ``user.tier`` (the 5.1
    tier-split-brain owner — the 5.3 grant writes it atomically with the
    subscription); status = the LATEST subscription row's status or null
    (the ``subscriptions_user_created_idx`` ordering — never a dead row);
    renews_on = the ISO local date of ``current_period_end`` or null. 200
    always (free users get the stable free shape — the header renders on
    every surface). RAW data only — the FE formats per AD-8; balances are
    the pill endpoint's job (no read duplication).
    """

    def get(self, request: Request) -> Response:
        from apps.billing.models import Subscription

        sub = (
            Subscription.objects.filter(user=request.user)
            # -id tiebreak: two rows created in the same microsecond would
            # otherwise resolve nondeterministically (review P8 — the test
            # suite already tripped this on Windows).
            .order_by('-created_at', '-id')
            .first()
        )
        return Response(
            {
                'tier': request.user.tier,
                'status': sub.status if sub is not None else None,
                'renews_on': (
                    timezone.localdate(sub.current_period_end).isoformat()
                    if sub is not None
                    else None
                ),
            }
        )


def _validation_response(exc: ValidationError) -> Response:
    detail = exc.detail
    message = str(detail[0]) if isinstance(detail, list) else str(detail)
    codes = exc.get_codes()
    code: object = codes[0] if isinstance(codes, list) and len(codes) == 1 else codes
    return Response({'detail': message, 'code': code}, status=400)


class CreateCheckoutView(APIView):
    """POST /api/billing/create-checkout/ — Chargily redirect URL.

    5.2 D6: pass-through ({type, amount} validated, NO payment_transactions
    row — the webhook creates the row). The response carries the Chargily
    checkout id so the 5.6 status-card polling has a key (5.2 D14).

    5.3 (D5/D4): the server price table + FR-24 precondition land here —
    subscription checkouts must match the server price (400 on mismatch,
    client amount never forwarded) and the user must not hold an ACTIVE
    subscription (409).

    5.4 (D13): the pack branch enforces the PACK_PRICES table the same way —
    400 ``pack_price_mismatch`` on off-table amounts, the server amount +
    pack description ship (client values never trusted). NO active-sub 409
    for packs (FR-24 exclusivity is subscription-only; FR-25 permits packs
    for free users and alongside subscriptions).
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

        if checkout_type == 'subscription':
            if amount != SUBSCRIPTION_PRICE_DZD:
                return Response(
                    {
                        'detail': 'subscription amount must match the server price',
                        'code': 'subscription_price_mismatch',
                    },
                    status=400,
                )
            from apps.billing.models import Subscription

            if Subscription.objects.filter(
                user=request.user, status='active'
            ).exists():
                return Response(
                    {
                        'detail': 'an active subscription already exists',
                        'code': 'active_subscription_exists',
                    },
                    status=409,
                )
            # The client amount is validated but never forwarded — the server
            # constant ships (5.3 D5).
            plan_data = {
                'user_id': str(request.user.pk),
                'type': checkout_type,
                'amount': SUBSCRIPTION_PRICE_DZD,
                'description': SUBSCRIPTION_DESCRIPTION,
            }
        else:
            if amount not in PACK_PRICES:
                return Response(
                    {
                        'detail': 'pack amount must match a server pack price',
                        'code': 'pack_price_mismatch',
                    },
                    status=400,
                )
            plan_data = {
                'user_id': str(request.user.pk),
                'type': checkout_type,
                'amount': amount,
                'description': PACK_DESCRIPTIONS[amount],
            }

        try:
            details = create_checkout_details(plan_data)
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
