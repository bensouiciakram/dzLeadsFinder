"""Search filter parsing and validation for the search API endpoints."""

import json
from dataclasses import dataclass, field
from typing import Any

from rest_framework.exceptions import ValidationError

SENIORITY_BANDS: list[str] = [
    'owner_founder',
    'c_level',
    'director',
    'manager',
    'individual_contributor',
]

SIZE_BANDS: list[str] = ['1-10', '11-50', '51-200', '201-500', '500+']

SEARCH_FILTER_KEYS: frozenset[str] = frozenset(
    {'industry', 'wilaya', 'seniority', 'keyword', 'size', 'include_unknown_size'}
)

PEOPLE_SORT_FIELDS: frozenset[str] = frozenset({'name', 'role', 'company_name', 'wilaya_code'})
COMPANY_SORT_FIELDS: frozenset[str] = frozenset(
    {'name', 'size_band', 'wilaya_code', 'people_count'}
)

SORT_DIRECTIONS: frozenset[str] = frozenset({'asc', 'desc'})

MAX_FILTERS_LENGTH: int = 8192


@dataclass
class SearchFilters:
    industry: list[int] = field(default_factory=list)
    wilaya: list[int] = field(default_factory=list)
    seniority: list[str] = field(default_factory=list)
    size: list[str] = field(default_factory=list)
    keyword: str | None = None
    include_unknown_size: bool = False


def parse_filters(raw: str | None, *, include_company_fields: bool = False) -> SearchFilters:
    from apps.search.serializers import SearchFiltersSerializer

    if not raw:
        return SearchFilters()
    if len(raw) > MAX_FILTERS_LENGTH:
        raise ValidationError('filters payload is too large.', code='invalid_filters')
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError:
        raise ValidationError('filters must be a valid JSON object.', code='invalid_filters')
    if not isinstance(payload, dict):
        raise ValidationError('filters must be a valid JSON object.', code='invalid_filters')
    serializer = SearchFiltersSerializer(
        data=payload, context={'include_company_fields': include_company_fields}
    )
    if not serializer.is_valid():
        raise ValidationError(str(serializer.errors), code='invalid_filter')
    validated = serializer.validated_data
    keyword = validated.get('keyword')
    return SearchFilters(
        industry=validated.get('industry', []),
        wilaya=validated.get('wilaya', []),
        seniority=validated.get('seniority', []),
        size=validated.get('size', []),
        keyword=keyword.strip() if keyword else None,
        include_unknown_size=bool(validated.get('include_unknown_size', False)),
    )


def parse_sort(raw: str | None, allowed: frozenset[str]) -> tuple[str, str]:
    if not raw:
        return ('name', 'asc')
    if ':' in raw:
        field_name, _, direction = raw.rpartition(':')
    else:
        field_name, direction = raw, 'asc'
    if field_name not in allowed or direction not in SORT_DIRECTIONS:
        raise ValidationError(f'Invalid sort: {raw}', code='invalid_sort')
    return (field_name, direction)


def parse_page(raw: str | None) -> int:
    if raw is None:
        return 1
    try:
        page = int(raw)
    except ValueError:
        raise ValidationError(f'Invalid page: {raw}', code='invalid_page')
    if page < 1:
        raise ValidationError(f'Invalid page: {raw}', code='invalid_page')
    return page
