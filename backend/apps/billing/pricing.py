"""Server-side pricing table + calendar-month math (5.3 Task 1).

The V1 price table is fixed (FR-24): one Starter tier at 1,500 DZD/mo for
200 credits. Pack prices are 5.4's deliverable — they do NOT live here yet.

STDLIB ONLY (5.3 D5): this module is imported by ``apps/billing/tasks.py``
at module level, and Celery imports task modules before the Django app
registry is ready (the 5.2 D9 constraint — the email_tasks precedent).
Any Django import here breaks worker startup.
"""

from datetime import date, datetime
from typing import Union, overload

SUBSCRIPTION_PRICE_DZD: int = 1500
SUBSCRIPTION_CREDITS: int = 200
SUBSCRIPTION_DESCRIPTION: str = 'DZLeads Starter — 200 credits/mo'

# PG int4 parity — the payments_amount_range_check upper bound (5.1 D14).
# Single source for the model constraint, the checkout validation and the
# webhook amount guard (each used to re-spell the magic number).
MAX_AMOUNT_DZD: int = 2147483647

# One-time add-on packs (5.4 Task 1 — FR-25): price DZD -> credits. Packs
# never expire and never auto-renew. The Chargily payload description carries
# the "never expires" qualifier — load-bearing trust copy on the payment page
# (Sally R4; Winston Q1). The FE (5.5 PackCards) consumes THIS table — the
# client never computes prices or unit rates itself (D12).
PACK_PRICES: dict[int, int] = {500: 75, 1500: 250}
PACK_DESCRIPTIONS: dict[int, str] = {
    500: 'DZLeads Pack — 75 credits, never expires',
    1500: 'DZLeads Pack — 250 credits, never expires',
}


def _pack_unit_price(price_dzd: int, credits: int) -> str:
    """Per-credit unit price as a one-decimal string (6.7 / 6.0 DZD).

    Rounding is explicit (``round(price / credits, 1)``) so the 5.5 cards
    never divide themselves (division drift + the AD-8 numeral hazard).
    ``credits <= 0`` cannot happen with the table constants — the guard
    keeps a mis-imported call from crashing the 5.5 render (Edge Hunter E1).
    """
    if credits <= 0:
        return ''
    return str(round(price_dzd / credits, 1))


# The 5.5-consumable contract fields (review RP7 — the amended AC clause 1
# requires a never-expiry flag and pre-computed unit prices; the flag is a
# single table-level constant for V1 — every pack never expires). Defined
# after the helper so the comprehension runs against a defined function.
PACK_NEVER_EXPIRES: bool = True
PACK_UNIT_PRICES: dict[int, str] = {
    price: _pack_unit_price(price, credits)
    for price, credits in PACK_PRICES.items()
}

_DateLike = Union[date, datetime]


@overload
def _add_month(value: datetime) -> datetime: ...


@overload
def _add_month(value: date) -> date: ...


def _add_month(value: _DateLike) -> _DateLike:
    """Calendar-month arithmetic: one month later, day clamped to month length.

    ``timedelta(days=30)`` is deliberately rejected (5.3 D7): it drifts
    ~5-6 days per year and misaligns the renewal anchor with the AC's
    "next cycle would have begun" semantics.
    """
    if value.month == 12:
        next_year, next_month = value.year + 1, 1
    else:
        next_year, next_month = value.year, value.month + 1
    import calendar

    day = min(value.day, calendar.monthrange(next_year, next_month)[1])
    if isinstance(value, datetime):
        return datetime(
            next_year, next_month, day, value.hour, value.minute, value.second,
            value.microsecond, tzinfo=value.tzinfo,
        )
    return date(next_year, next_month, day)
