"""Credit services: the atomic reveal debit and ledger-based balance reads."""

from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import connection, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone

from apps.credits.models import CreditEventType, CreditLedger, Reveal

RE_REVEAL_WINDOW_DAYS = 30
RECORD_TYPE_PEOPLE = 'people'
RECORD_TYPE_COMPANY = 'company'

_REVEAL_COST = 1


class InsufficientCreditsError(Exception):
    """Raised when the user's ledger balance cannot cover a reveal."""


class RevealRecordNotFoundError(Exception):
    """Raised when the target people/company record does not exist."""


def _serializable_guard() -> None:
    """Pin the transaction to SERIALIZABLE on PostgreSQL (AD-3).

    SQLite (the test DB) has no SET TRANSACTION syntax — the guard is a
    no-op there; isolation semantics are verified on the real PG16 stack.
    Must be the first statement inside the atomic block.
    """
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')


def _contact_data(record_type: str, record: Any) -> dict[str, Any]:
    """The contact payload the reveal surface returns (4.2 consumes it)."""
    if record_type == RECORD_TYPE_PEOPLE:
        company = record.company
        return {
            'record_type': record_type,
            'record_id': str(record.id),
            'name': record.name,
            'role': record.role,
            'company_name': (company.name if company is not None else None),
            'email': record.email,
            'phone': record.phone,
            'address': record.address,
        }
    wilaya = record.wilaya_code
    industry = record.industry
    return {
        'record_type': record_type,
        'record_id': str(record.id),
        'name': record.name,
        'industry': (industry.name_en if industry is not None else None),
        'website': record.website,
        'wilaya_code': (wilaya.code if wilaya is not None else None),
        'size_band': record.size_band,
    }


def _pool_balances(user: Any) -> tuple[int, int]:
    row = CreditLedger.objects.filter(user_id=user.id).aggregate(
        subscription=Sum('amount', filter=Q(pool='subscription')),
        pack=Sum('amount', filter=Q(pool='pack')),
    )
    return row['subscription'] or 0, row['pack'] or 0


def reveal_contact(user: Any, record_type: str, record_id: str) -> dict[str, Any]:
    """Unlock a record's contact data: debits 1 credit atomically, or serves
    the free re-reveal path within the 30-day window.

    Balance is always computed from the ledger inside the SERIALIZABLE
    transaction — never from `users.credits_balance` (AD-4).
    """
    from apps.search.models import Company, Person

    if record_type == RECORD_TYPE_PEOPLE:
        try:
            record = Person.objects.filter(pk=record_id).first()
        except (ValueError, TypeError, ValidationError):
            record = None
    elif record_type == RECORD_TYPE_COMPANY:
        try:
            record = Company.objects.filter(pk=record_id).first()
        except (ValueError, TypeError, ValidationError):
            record = None
    else:
        record = None
    if record is None:
        raise RevealRecordNotFoundError(
            f'No {record_type} record with id {record_id}'
        )
    # Canonicalize: UUIDs have many textual forms (uppercase, no hyphens,
    # braces) — storing the raw input would duplicate paid rows per variant
    # and break the search revealed-flag match (which uses str(row.id)).
    record_id = str(record.id)
    contact = _contact_data(record_type, record)

    with transaction.atomic():
        # SERIALIZABLE must be the FIRST statement on PG (it starts the
        # transaction at that isolation) — so the guard precedes the lock.
        _serializable_guard()
        # Serialize ALL credit mutations per user (the 3.6 saved-search cap
        # precedent): the lock is the primary concurrency guard and works on
        # every isolation level (SQLite tests included). It makes the
        # window-check → insert sequence atomic: a concurrent reveal of the
        # same record either waits and lands on the free path, or aborts
        # before any write. The SERIALIZABLE guard is defense-in-depth.
        get_user_model().objects.select_for_update().get(pk=user.id)
        revealed_within_window = Reveal.objects.filter(
            user_id=user.id,
            record_type=record_type,
            record_id=record_id,
            created_at__gte=timezone.now() - timedelta(days=RE_REVEAL_WINDOW_DAYS),
        ).exists()
        if revealed_within_window:
            Reveal.objects.create(
                user=user,
                record_type=record_type,
                record_id=record_id,
                was_free=True,
            )
            return contact

        subscription_balance, pack_balance = _pool_balances(user)
        total = subscription_balance + pack_balance
        if total < _REVEAL_COST:
            raise InsufficientCreditsError(
                f'User {user.id} has {total} credits — a reveal costs {_REVEAL_COST}'
            )
        pool = 'subscription' if subscription_balance >= _REVEAL_COST else 'pack'
        paid_row = Reveal.objects.filter(
            user_id=user.id,
            record_type=record_type,
            record_id=record_id,
            was_free=False,
        ).first()
        if paid_row is None:
            reveal = Reveal.objects.create(
                user=user,
                record_type=record_type,
                record_id=record_id,
                credit_cost=_REVEAL_COST,
            )
            reference_id = str(reveal.id)
        else:
            # The partial unique index allows exactly one paid row per record
            # for ever — a paid reveal after the 30-day window renews the row
            # (rolling window: each charge buys another 30 days, the index
            # stays the idempotency guard against concurrent double-charges).
            Reveal.objects.filter(pk=paid_row.pk).update(created_at=timezone.now())
            reference_id = str(paid_row.id)
        CreditLedger.objects.create(
            user=user,
            event_type=CreditEventType.REVEAL_DEBIT,
            amount=-_REVEAL_COST,
            balance_after=total - _REVEAL_COST,
            pool=pool,
            reference_id=reference_id,
        )
        get_user_model().objects.filter(pk=user.id).update(
            credits_balance=F('credits_balance') - _REVEAL_COST
        )
        user.credits_balance -= _REVEAL_COST
        return contact


def user_balances(user: Any) -> dict[str, int]:
    """Ledger-derived balances (FR-15 read path — the pill/ledger pages)."""
    subscription_balance, pack_balance = _pool_balances(user)
    return {
        'subscription_balance': subscription_balance,
        'pack_balance': pack_balance,
        'display_balance': subscription_balance + pack_balance,
    }
