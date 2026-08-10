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
