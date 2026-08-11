from datetime import timedelta
from typing import Any

from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.chargily import ChargilyError, create_checkout_details
from apps.billing.pricing import (
    PACK_DESCRIPTIONS,
    PACK_NEVER_EXPIRES,
    PACK_PRICES,
    PACK_UNIT_PRICES,
    SUBSCRIPTION_DESCRIPTION,
    SUBSCRIPTION_PRICE_DZD,
)

PAYMENT_TYPES = frozenset({'subscription', 'pack'})
# PG int4 parity — 5.1 D14 `payments_amount_range_check` upper bound.
MAX_AMOUNT_DZD = 2147483647


class PacksView(APIView):
    """GET /api/billing/packs/ — the 5.5 HTTP surface for the 5.4 pack table.

    Serves the pricing.py pack contract verbatim (5.4 RP7 handoff — the FE
    cannot import the Python module): ``{packs: [{amount, credits,
    description, unit_price, never_expires, best_value}], never_expires}``.
    ``best_value`` is derived from the table (``amount == max(PACK_PRICES)``)
    — a price-table change flips the badge without touching this view.
    ``unit_price`` ships the exact server string ('6.7'/'6.0', 5.4 RP7) — the
    FE renders it verbatim and never divides (5.4 D12; AD-8 dot stability).
    """

    def get(self, request: Request) -> Response:
        packs = [
            {
                'amount': amount,
                'credits': credits,
                'description': PACK_DESCRIPTIONS[amount],
                'unit_price': PACK_UNIT_PRICES[amount],
                'never_expires': PACK_NEVER_EXPIRES,
                'best_value': amount == max(PACK_PRICES),
            }
            for amount, credits in PACK_PRICES.items()
        ]
        return Response({'packs': packs, 'never_expires': PACK_NEVER_EXPIRES})


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

    5.5 (Winston Q4): the Plan Card needs "credits left this cycle" — the
    plan endpoint EXTENDS with an additive ``balances`` key from
    ``user_balances()`` (subscription pool = the cycle credits; the 5.3
    D12 "pill endpoint" comment is stale — no pill endpoint exists, and a
    separate endpoint would have exactly one consumer and two round-trips).
    Additive only: the 5.7 chip/banner consumers are untouched.
    """

    def get(self, request: Request) -> Response:
        from apps.billing.models import Subscription
        from apps.credits.services import user_balances

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
                'balances': user_balances(request.user),
            }
        )


class HistoryView(APIView):
    """GET /api/billing/history/ — the Payment History table (5.5).

    Contract (Winston Q2 / John V4): ``{results: [{id, date, amount_dzd,
    type, status, credits_granted}]}`` — newest-first (``-created_at``,
    ``-id`` — the P8 deterministic-ordering precedent), fixed cap of 50 at
    V1 (the LEDGER_PAGE_SIZE precedent; pagination is a V1.5 concern), ALL
    statuses included (pending / succeeded / failed / refunded — John V4:
    a pending row answers "my money went somewhere" after a polling
    timeout; a failed row is the 5.5 failure surface). Raw type/status
    codes (the ledger precedent — localization is frontend-owned, AD-8);
    ``date`` is the ISO created_at.
    """

    HISTORY_LIMIT = 50

    def get(self, request: Request) -> Response:
        from apps.billing.models import PaymentTransaction

        rows = PaymentTransaction.objects.filter(user=request.user).order_by(
            '-created_at', '-id'
        )[: self.HISTORY_LIMIT]
        return Response(
            {
                'results': [
                    {
                        'id': str(row.id),
                        'date': row.created_at.isoformat(),
                        'amount_dzd': row.amount_dzd,
                        'type': row.type,
                        'status': row.status,
                        'credits_granted': row.credits_granted,
                    }
                    for row in rows
                ]
            }
        )


class CancelView(APIView):
    """POST /api/billing/cancel/ — the Danger Zone's cancel flow (5.5).

    Contract (Winston Q3 / John V2): ACTIVE subscription → 200
    ``{status: 'cancelled', cancelled_at: ISO}`` (cancelled_at written with
    the status flip — ``subscriptions_cancel_state_check``); already
    cancelled → idempotent 200; failed_renewal/expired → 409
    ``subscription_not_active``; no row → 409 ``subscription_not_found``.
    Lock discipline: user row FIRST, then the subscription row, status
    re-checked UNDER the sub lock (the grant D8 discipline — no ABBA cycle
    with the grant/expiry tasks). user.tier untouched (5.7 cancel sync);
    no Chargily call; no ledger/cache writes (the no-auto-renewal
    guarantee is a state flip only).
    """

    def post(self, request: Request) -> Response:
        from django.contrib.auth import get_user_model
        from django.db import transaction
        from django.utils import timezone

        from apps.billing.models import Subscription

        with transaction.atomic():
            user_model = get_user_model()
            try:
                user_model.objects.select_for_update().get(pk=request.user.pk)
            except user_model.DoesNotExist:
                pass
            sub = (
                Subscription.objects.select_for_update()
                .filter(user=request.user)
                .order_by('-created_at', '-id')
                .first()
            )
            if sub is None:
                return Response(
                    {
                        'detail': 'no subscription to cancel',
                        'code': 'subscription_not_found',
                    },
                    status=409,
                )
            if sub.status == 'cancelled':
                # Idempotent 200 (John V2). The constraint is one-directional
                # (subscriptions_cancel_state_check forbids cancelled_at on a
                # non-cancelled row but ALLOWS a cancelled row with NULL
                # cancelled_at — legacy/manual data): guard the heal, then
                # report the actual value (review P3 — a NULL would 500).
                if sub.cancelled_at is None:
                    now = timezone.now()
                    sub.cancelled_at = now
                    sub.save(update_fields=['cancelled_at'])
                return Response(
                    {
                        'status': 'cancelled',
                        'cancelled_at': sub.cancelled_at.isoformat(),
                    },
                    status=200,
                )
            if sub.status != 'active':
                return Response(
                    {
                        'detail': 'only an active subscription can be cancelled',
                        'code': 'subscription_not_active',
                    },
                    status=409,
                )
            now = timezone.now()
            sub.status = 'cancelled'
            sub.cancelled_at = now
            sub.save(update_fields=['status', 'cancelled_at'])
            return Response(
                {'status': 'cancelled', 'cancelled_at': now.isoformat()}, status=200
            )


class StatusView(APIView):
    """GET /api/billing/status/{txn_id}/ — the 5.6 payment-polling endpoint.

    ``txn_id`` = the Chargily CHECKOUT id (5.2 D14 — the create-checkout
    response id), never a payment_transactions id. The row is resolved
    USER-SCOPED and SINCE-BOUND: ``since`` is REQUIRED (an ISO datetime —
    the FE echoes the server-issued checkout ``started_at`` back), so a row
    created before the checkout began can never be that checkout's row (the
    false-success guard). The lookup NEVER relies on
    ``chargily_metadata.checkout_id`` — that field stores the webhook EVENT
    id (deferred-work 5.2 B13); the exact checkout-id match is V1.5 behind
    the docs gate (column + webhook write + exact lookup).

    Contract (Winston Q1-Q3): ``{id, status, type, credits_granted, date}``
    — RAW codes (the ledger precedent — the FE localizes per AD-8); no row
    in range returns the SAME shape with ``status='pending'`` and nulls
    (absence is a state — never 404 mid-poll, an error branch in the 5s
    poll loop is worse); failed/refunded rows report raw (the FE maps
    refunded into the failed family). Read-only and lock-free: the grant
    task owns status transitions under its row lock — a poll observes
    pre- or post-commit state, never torn (monotonic pending→succeeded/
    failed). The ``payments_user_created_idx`` index covers the lookup
    (equality user + range created_at) — no new index, no migration.
    """

    MAX_TXN_ID_LENGTH = 255

    def get(self, request: Request, txn_id: str) -> Response:
        from django.utils.dateparse import parse_datetime

        from apps.billing.models import PaymentTransaction

        if not txn_id or len(txn_id) > self.MAX_TXN_ID_LENGTH:
            return Response(
                {
                    'detail': 'txn_id must be a non-empty string '
                    f'≤ {self.MAX_TXN_ID_LENGTH} characters',
                    'code': 'invalid_txn_id',
                },
                status=400,
            )
        since_raw = request.query_params.get('since')
        if not since_raw:
            # Never a silent default: without a bound, a stale succeeded row
            # from a previous checkout would flip the card (Winston Q1 — a
            # default IS the rejected option (c)).
            return Response(
                {'detail': 'since is required', 'code': 'since_required'},
                status=400,
            )
        since = parse_datetime(since_raw)
        if since is None:
            return Response(
                {'detail': 'since must be an ISO 8601 datetime', 'code': 'invalid_since'},
                status=400,
            )
        if timezone.is_naive(since):
            # SQLite stores naive-UTC, PG aware — comparisons must be TZ
            # consistent (Winston Q5).
            from datetime import timezone as dt_timezone

            since = timezone.make_aware(since, dt_timezone.utc)
        # Review P5: cap the window. The `since` bound is client-supplied —
        # a tampered stash with an ancient started_at would defeat the
        # false-success guard (an old succeeded row flips the card). The
        # polling + reconciliation horizon is minutes; 24h is generous for
        # any realistic return while bounding the lookup to this checkout's
        # era.
        if since < timezone.now() - timedelta(hours=24):
            return Response(
                {
                    'detail': 'since must be within the last 24 hours',
                    'code': 'invalid_since',
                },
                status=400,
            )

        row = (
            PaymentTransaction.objects.filter(
                user=request.user, created_at__gte=since
            )
            # -id tiebreak: the P8 deterministic-ordering precedent.
            .order_by('-created_at', '-id')
            .first()
        )
        if row is None:
            return Response(
                {
                    'id': None,
                    'status': 'pending',
                    'type': None,
                    'credits_granted': None,
                    'date': None,
                }
            )
        return Response(
            {
                'id': str(row.id),
                'status': row.status,
                'type': row.type,
                'credits_granted': row.credits_granted,
                'date': row.created_at.isoformat(),
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
            {
                'checkout_url': details.checkout_url,
                'checkout_id': details.checkout_id,
                # 5.6 (Winston Q6): the additive started_at is the exact
                # since-bound for the status polling — server-issued so
                # client-ahead/behind skew cannot widen the old-row window.
                'started_at': timezone.now().isoformat(),
            }
        )
