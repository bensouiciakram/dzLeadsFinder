from datetime import date, datetime
from datetime import timezone as dt_timezone
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db.models import F
from django.utils import timezone

from apps.search.models import DailyUsage

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema_user(create_user: object) -> object:
    return create_user


class TestDailyUsageDefaults:
    def test_date_defaults_to_localdate(self, schema_user: object) -> None:
        usage = DailyUsage.objects.create(user=schema_user)
        assert usage.date == timezone.localdate()

    def test_counters_default_to_zero(self, schema_user: object) -> None:
        usage = DailyUsage.objects.create(user=schema_user)
        assert usage.search_count == 0
        assert usage.export_rows == 0

    def test_date_default_rolls_over_at_algiers_midnight(self, schema_user: object) -> None:
        winter_utc_2330 = datetime(2026, 1, 15, 23, 30, tzinfo=dt_timezone.utc)
        with patch('django.utils.timezone.now', return_value=winter_utc_2330):
            assert timezone.localdate() == date(2026, 1, 16)
            usage = DailyUsage.objects.create(user=schema_user)
            assert usage.date == date(2026, 1, 16)


class TestDailyUsageResetSemantics:
    def test_yesterday_row_is_not_today(self, schema_user: object) -> None:
        today = timezone.localdate()
        yesterday = today - timezone.timedelta(days=1)
        DailyUsage.objects.create(user=schema_user, date=yesterday, search_count=5)
        assert DailyUsage.objects.filter(user=schema_user, date=timezone.localdate()).count() == 0
        assert DailyUsage.objects.get(user=schema_user, date=yesterday).search_count == 5

    def test_two_users_can_share_a_day(self, schema_user: object) -> None:
        other = User.objects.create_user(email='other@example.com', password='SecurePass123!')
        DailyUsage.objects.create(user=schema_user)
        DailyUsage.objects.create(user=other)
        assert DailyUsage.objects.filter(date=timezone.localdate()).count() == 2

    def test_upsert_increments_without_duplicate_row(self, schema_user: object) -> None:
        today = timezone.localdate()
        for _ in range(2):
            updated = DailyUsage.objects.filter(user=schema_user, date=today).update(
                search_count=F('search_count') + 1,
            )
            if not updated:
                DailyUsage.objects.create(user=schema_user, date=today, search_count=1)
        assert DailyUsage.objects.filter(user=schema_user).count() == 1
        assert DailyUsage.objects.get(user=schema_user, date=today).search_count == 2
