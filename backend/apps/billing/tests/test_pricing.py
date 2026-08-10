"""Server-side pricing table + calendar-month helper (5.3 Task 1)."""

from datetime import date, datetime

from apps.billing import pricing
from apps.billing.pricing import (
    SUBSCRIPTION_CREDITS,
    SUBSCRIPTION_DESCRIPTION,
    SUBSCRIPTION_PRICE_DZD,
    _add_month,
)


class TestPricingConstants:
    def test_subscription_price_is_1500_dzd(self) -> None:
        assert SUBSCRIPTION_PRICE_DZD == 1500

    def test_subscription_grants_200_credits(self) -> None:
        assert SUBSCRIPTION_CREDITS == 200

    def test_subscription_description_exact_copy(self) -> None:
        assert SUBSCRIPTION_DESCRIPTION == 'DZLeads Starter — 200 credits/mo'

    def test_module_has_no_django_imports(self) -> None:
        """The module must be importable by tasks.py at module level (5.2 D9)."""
        import inspect

        source = inspect.getsource(pricing)
        assert 'django' not in source
        assert 'apps.' not in source


class TestAddMonth:
    def test_mid_month_passthrough(self) -> None:
        assert _add_month(datetime(2026, 8, 10, 12, 0, 0)) == datetime(2026, 9, 10, 12, 0, 0)

    def test_january_31_clamps_to_february(self) -> None:
        result = _add_month(datetime(2026, 1, 31, 23, 59, 59))
        assert (result.year, result.month, result.day) == (2026, 2, 28)

    def test_january_31_leap_year_clamps_to_29(self) -> None:
        result = _add_month(datetime(2024, 1, 31))
        assert (result.year, result.month, result.day) == (2024, 2, 29)

    def test_december_rolls_to_next_year(self) -> None:
        result = _add_month(datetime(2026, 12, 15))
        assert (result.year, result.month, result.day) == (2027, 1, 15)

    def test_april_30_passes_through_to_may_30(self) -> None:
        result = _add_month(datetime(2026, 4, 30))
        assert (result.year, result.month, result.day) == (2026, 5, 30)

    def test_march_31_clamps_to_april_30(self) -> None:
        result = _add_month(datetime(2026, 3, 31))
        assert (result.year, result.month, result.day) == (2026, 4, 30)

    def test_time_component_preserved_through_clamp(self) -> None:
        result = _add_month(datetime(2026, 1, 31, 8, 30, 15))
        assert (result.hour, result.minute, result.second) == (8, 30, 15)

    def test_accepts_date_objects(self) -> None:
        result = _add_month(date(2026, 8, 10))
        assert result == date(2026, 9, 10)
