"""Server-side pricing table + calendar-month helper (5.3 Task 1, 5.4 Task 1)."""

from datetime import date, datetime

import pytest

from apps.billing import pricing
from apps.billing.pricing import (
    PACK_DESCRIPTIONS,
    PACK_NEVER_EXPIRES,
    PACK_PRICES,
    PACK_UNIT_PRICES,
    SUBSCRIPTION_CREDITS,
    SUBSCRIPTION_DESCRIPTION,
    SUBSCRIPTION_PRICE_DZD,
    _add_month,
    _pack_unit_price,
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


class TestPackPricing:
    def test_pack_prices_map_exact_amounts(self) -> None:
        assert PACK_PRICES == {500: 75, 1500: 250}

    def test_pack_75_credits_description_exact_copy(self) -> None:
        assert PACK_DESCRIPTIONS[500] == 'DZLeads Pack — 75 credits, never expires'

    def test_pack_250_credits_description_exact_copy(self) -> None:
        assert PACK_DESCRIPTIONS[1500] == 'DZLeads Pack — 250 credits, never expires'

    def test_every_pack_price_has_a_description(self) -> None:
        assert set(PACK_DESCRIPTIONS) == set(PACK_PRICES)

    def test_unit_price_500_dzd_pack(self) -> None:
        assert _pack_unit_price(500, 75) == '6.7'

    def test_unit_price_1500_dzd_pack(self) -> None:
        assert _pack_unit_price(1500, 250) == '6.0'

    @pytest.mark.parametrize('price,credits', [(500, 75), (1500, 250)])
    def test_unit_price_is_one_decimal_string(self, price: int, credits: int) -> None:
        value = _pack_unit_price(price, credits)
        assert isinstance(value, str)
        assert value.replace('.', '', 1).isdigit()

    def test_unit_price_table_matches_helper(self) -> None:
        assert PACK_UNIT_PRICES == {
            price: _pack_unit_price(price, credits)
            for price, credits in PACK_PRICES.items()
        }
        assert PACK_UNIT_PRICES[500] == '6.7'
        assert PACK_UNIT_PRICES[1500] == '6.0'

    def test_never_expires_flag_is_exposed(self) -> None:
        """Review RP7 — the amended AC clause 1: the 5.5-consumable contract
        carries the never-expiry flag explicitly."""
        assert PACK_NEVER_EXPIRES is True

    def test_unit_price_helper_guards_non_positive_credits(self) -> None:
        assert _pack_unit_price(500, 0) == ''
        assert _pack_unit_price(500, -1) == ''

    def test_module_has_no_django_imports(self) -> None:
        import inspect

        source = inspect.getsource(pricing)
        assert 'django' not in source
        assert 'apps.' not in source
