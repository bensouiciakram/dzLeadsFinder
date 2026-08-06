"""Daily search quota: per-tier limits, localized messages, atomic upsert."""

from django.db import connection
from django.utils import timezone

SEARCH_DAILY_LIMITS: dict[str, int] = {'free': 30, 'starter': 100}

SAVED_SEARCH_CAPS: dict[str, int] = {'free': 5, 'starter': 25}

PAGE_SIZE: int = 100
MAX_NAVIGABLE_RESULTS: int = 1000
MAX_KEYWORD_LENGTH: int = 200
MAX_SAVED_SEARCH_NAME_LENGTH: int = 100

SEARCH_LIMIT_MESSAGES: dict[str, str] = {
    'ar': 'لقد بلغت الحد اليومي للبحث ({limit}) — قيّد بحثك أو عد غداً.',
    'fr': (
        'Vous avez atteint votre limite quotidienne de {limit} recherches — '
        'affinez votre recherche ou revenez demain.'
    ),
    'en': (
        'You have reached your daily search limit of {limit}. '
        'Refine your search or come back tomorrow.'
    ),
}

REFINE_PROMPT_MESSAGES: dict[str, str] = {
    'ar': 'لقد بلغت 1,000 نتيجة — قيّد بحثك لعرض نتائج إضافية.',
    'fr': 'Vous avez atteint 1 000 résultats — affinez vos filtres pour en voir plus.',
    'en': 'You have reached 1,000 results — refine your filters to see more.',
}

SAVED_SEARCH_LIMIT_MESSAGES: dict[str, str] = {
    'ar': 'بلغت الحد الأقصى للحسابات المحفوظة ({limit}) — احذف واحدة أو قم بالترقية.',
    'fr': (
        'Vous avez atteint la limite de recherches enregistrées ({limit}) — '
        'supprimez-en une ou passez à Starter.'
    ),
    'en': (
        'You have reached the saved search limit ({limit}). '
        'Delete one or upgrade to Starter.'
    ),
}

UPSERT_SEARCH_COUNT_SQL: str = (
    'INSERT INTO daily_usage (user_id, date, search_count) VALUES (%s, %s, 1) '
    'ON CONFLICT (user_id, date) DO UPDATE SET search_count = daily_usage.search_count + 1'
)


def daily_limit_for(user: object) -> int:
    tier = getattr(user, 'tier', 'free')
    return SEARCH_DAILY_LIMITS.get(tier, SEARCH_DAILY_LIMITS['free'])


def saved_search_limit_for(user: object) -> int:
    tier = getattr(user, 'tier', 'free')
    return SAVED_SEARCH_CAPS.get(tier, SAVED_SEARCH_CAPS['free'])


def daily_limit_reached(user: object) -> bool:
    from apps.search.models import DailyUsage

    limit = daily_limit_for(user)
    count = (
        DailyUsage.objects.filter(user_id=getattr(user, 'id'), date=timezone.localdate())
        .values_list('search_count', flat=True)
        .first()
    )
    return count is not None and count >= limit


def increment_search_count(user: object) -> None:
    with connection.cursor() as cursor:
        cursor.execute(UPSERT_SEARCH_COUNT_SQL, [getattr(user, 'id'), timezone.localdate()])
