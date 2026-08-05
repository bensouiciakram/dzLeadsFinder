import inspect

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.search import quota
from apps.search.models import DailyUsage

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema_user(create_user: object) -> object:
    return create_user


class TestDailyLimitResolution:
    def test_free_tier_limit_is_30(self, schema_user: object) -> None:
        assert quota.daily_limit_for(schema_user) == 30

    def test_starter_tier_limit_is_100(self, schema_user: object) -> None:
        starter = User.objects.create_user(
            email='starter@example.com', password='SecurePass123!', tier='starter'
        )
        assert quota.daily_limit_for(starter) == 100

    def test_unknown_tier_falls_back_to_free(self, schema_user: object) -> None:
        gold = User.objects.create_user(
            email='gold@example.com', password='SecurePass123!', tier='gold'
        )
        assert quota.daily_limit_for(gold) == 30


class TestDailyLimitReached:
    def test_free_not_reached_below_limit(self, schema_user: object) -> None:
        DailyUsage.objects.create(user=schema_user, search_count=29)
        assert quota.daily_limit_reached(schema_user) is False

    def test_free_reached_at_limit(self, schema_user: object) -> None:
        DailyUsage.objects.create(user=schema_user, search_count=30)
        assert quota.daily_limit_reached(schema_user) is True

    def test_starter_not_reached_below_limit(self, schema_user: object) -> None:
        starter = User.objects.create_user(
            email='starter@example.com', password='SecurePass123!', tier='starter'
        )
        DailyUsage.objects.create(user=starter, search_count=99)
        assert quota.daily_limit_reached(starter) is False

    def test_starter_reached_at_limit(self, schema_user: object) -> None:
        starter = User.objects.create_user(
            email='starter@example.com', password='SecurePass123!', tier='starter'
        )
        DailyUsage.objects.create(user=starter, search_count=100)
        assert quota.daily_limit_reached(starter) is True

    def test_no_row_today_is_not_reached(self, schema_user: object) -> None:
        assert quota.daily_limit_reached(schema_user) is False


class TestAtomicUpsert:
    def test_first_call_creates_row_with_count_one(self, schema_user: object) -> None:
        quota.increment_search_count(schema_user)
        assert DailyUsage.objects.filter(user=schema_user).count() == 1
        usage = DailyUsage.objects.get(user=schema_user, date=timezone.localdate())
        assert usage.search_count == 1

    def test_second_call_increments_single_row(self, schema_user: object) -> None:
        quota.increment_search_count(schema_user)
        quota.increment_search_count(schema_user)
        assert DailyUsage.objects.filter(user=schema_user).count() == 1
        usage = DailyUsage.objects.get(user=schema_user, date=timezone.localdate())
        assert usage.search_count == 2

    def test_users_have_independent_rows(self, schema_user: object) -> None:
        other = User.objects.create_user(email='other@example.com', password='SecurePass123!')
        quota.increment_search_count(schema_user)
        quota.increment_search_count(other)
        quota.increment_search_count(other)
        assert DailyUsage.objects.get(user=schema_user, date=timezone.localdate()).search_count == 1
        assert DailyUsage.objects.get(user=other, date=timezone.localdate()).search_count == 2

    def test_yesterday_row_is_untouched_by_today_upsert(self, schema_user: object) -> None:
        yesterday = timezone.localdate() - timezone.timedelta(days=1)
        DailyUsage.objects.create(user=schema_user, date=yesterday, search_count=5)
        quota.increment_search_count(schema_user)
        assert DailyUsage.objects.get(user=schema_user, date=yesterday).search_count == 5
        assert DailyUsage.objects.get(user=schema_user, date=timezone.localdate()).search_count == 1

    def test_upsert_sql_uses_on_conflict_directive(self) -> None:
        source = inspect.getsource(quota)
        assert "ON CONFLICT (user_id, date) DO UPDATE" in source
        assert "daily_usage.search_count + 1" in source


class TestLocalizedMessages:
    def test_limit_messages_exist_for_all_locales(self) -> None:
        assert set(quota.SEARCH_LIMIT_MESSAGES.keys()) == {'ar', 'fr', 'en'}

    def test_limit_message_formats_the_limit(self) -> None:
        for message in quota.SEARCH_LIMIT_MESSAGES.values():
            assert '30' in message.format(limit=30)

    def test_refine_prompt_messages_exist_for_all_locales(self) -> None:
        assert set(quota.REFINE_PROMPT_MESSAGES.keys()) == {'ar', 'fr', 'en'}

    def test_refine_prompt_messages_are_nonempty(self) -> None:
        for message in quota.REFINE_PROMPT_MESSAGES.values():
            assert message.strip()
