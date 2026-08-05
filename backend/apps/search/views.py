"""Search API endpoint views for People and Company search."""

from django.db.models import Case, Count, F, IntegerField, Q, Value, When
from django.db.models.expressions import Expression
from django.db.models.query import QuerySet
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.search import quota
from apps.search.filters import (
    COMPANY_SORT_FIELDS,
    PEOPLE_SORT_FIELDS,
    SIZE_BANDS,
    SearchFilters,
    parse_filters,
    parse_page,
    parse_sort,
)
from apps.search.fts import company_keyword_q, people_keyword_q
from apps.search.models import Company, Person

_LOCALES = frozenset({'ar', 'fr', 'en'})

_PEOPLE_SORT: dict[str, str] = {
    'name': 'name',
    'role': 'role',
    'company_name': 'company__name',
    'wilaya_code': 'company__wilaya_code',
}

_COMPANY_SORT: dict[str, str] = {
    'name': 'name',
    'size_band': 'size_band',
    'wilaya_code': 'wilaya_code',
    'people_count': 'people_count',
}

_SIZE_BAND_ORDER = Case(
    *[When(size_band=band, then=Value(index)) for index, band in enumerate(SIZE_BANDS, start=1)],
    default=None,
    output_field=IntegerField(),
)


def _locale(user: object) -> str:
    locale = getattr(user, 'locale', 'en')
    return locale if locale in _LOCALES else 'en'


def _quota_error(user: object) -> Response | None:
    if not quota.daily_limit_reached(user):
        return None
    limit = quota.daily_limit_for(user)
    message = quota.SEARCH_LIMIT_MESSAGES[_locale(user)].format(limit=limit)
    return Response(
        {'detail': message, 'code': 'search_limit_exceeded', 'limit': limit}, status=429
    )


def _order_by(qs: QuerySet, field: str, direction: str, sort_map: dict[str, str]) -> QuerySet:
    key = sort_map[field]
    expression: Expression = _SIZE_BAND_ORDER if key == 'size_band' else F(key)
    if direction == 'desc':
        return qs.order_by(expression.desc(nulls_last=True))
    return qs.order_by(expression.asc(nulls_last=True))


def _truncated_payload(total: int, page: int, user: object) -> dict[str, object]:
    truncated = total > quota.MAX_NAVIGABLE_RESULTS
    return {
        'total': total,
        'page': page,
        'truncated': truncated,
        'refine_prompt': quota.REFINE_PROMPT_MESSAGES[_locale(user)] if truncated else None,
    }


def _people_conditions(filters: SearchFilters) -> list[Q]:
    conditions: list[Q] = []
    if filters.industry:
        conditions.append(Q(company__industry_id__in=filters.industry))
    if filters.wilaya:
        conditions.append(Q(company__wilaya_code__in=filters.wilaya))
    if filters.seniority:
        conditions.append(Q(seniority__in=filters.seniority))
    keyword_clause = people_keyword_q(filters.keyword)
    if keyword_clause is not None:
        conditions.append(keyword_clause)
    return conditions


def _company_conditions(filters: SearchFilters) -> list[Q]:
    conditions: list[Q] = []
    if filters.industry:
        conditions.append(Q(industry_id__in=filters.industry))
    if filters.wilaya:
        conditions.append(Q(wilaya_code__in=filters.wilaya))
    if filters.size:
        size_match = Q(size_band__in=filters.size)
        if filters.include_unknown_size:
            size_match = size_match | Q(size_band__isnull=True)
        conditions.append(size_match)
    keyword_clause = company_keyword_q(filters.keyword)
    if keyword_clause is not None:
        conditions.append(keyword_clause)
    return conditions


def _people_row(person: Person, locale: str) -> dict[str, object]:
    company = person.company
    wilaya = company.wilaya_code if company is not None else None
    return {
        'id': str(person.id),
        'name': person.name,
        'role': person.role,
        'company_name': company.name if company is not None else None,
        'wilaya_code': wilaya.code if wilaya is not None else None,
        'wilaya_name': getattr(wilaya, f'name_{locale}') if wilaya is not None else None,
        'revealed': False,
    }


def _company_row(company: Company, locale: str) -> dict[str, object]:
    wilaya = company.wilaya_code
    industry = company.industry
    return {
        'id': str(company.id),
        'name': company.name,
        'industry': getattr(industry, f'name_{locale}') if industry is not None else None,
        'industry_id': company.industry_id,
        'wilaya_code': wilaya.code if wilaya is not None else None,
        'wilaya_name': getattr(wilaya, f'name_{locale}') if wilaya is not None else None,
        'size_band': company.size_band,
        'people_count': getattr(company, 'people_count', 0),
    }


def _validation_response(exc: ValidationError) -> Response:
    detail = exc.detail
    message = str(detail[0]) if isinstance(detail, list) else str(detail)
    codes = exc.get_codes()
    code: object = codes[0] if isinstance(codes, list) and len(codes) == 1 else codes
    return Response({'detail': message, 'code': code}, status=400)


def _page_out_of_range() -> Response:
    return Response(
        {'detail': 'Only the first 1,000 results are navigable.', 'code': 'page_out_of_range'},
        status=400,
    )


class PeopleSearchView(APIView):
    def get(self, request: Request) -> Response:
        try:
            filters = parse_filters(request.query_params.get('filters'))
            sort_field, direction = parse_sort(request.query_params.get('sort'), PEOPLE_SORT_FIELDS)
            page = parse_page(request.query_params.get('page'))
        except ValidationError as exc:
            return _validation_response(exc)
        if (page - 1) * quota.PAGE_SIZE >= quota.MAX_NAVIGABLE_RESULTS:
            return _page_out_of_range()
        error = _quota_error(request.user)
        if error is not None:
            return error
        queryset = Person.objects.select_related('company__wilaya_code')
        for condition in _people_conditions(filters):
            queryset = queryset.filter(condition)
        queryset = _order_by(queryset, sort_field, direction, _PEOPLE_SORT)
        total = queryset.count()
        offset = (page - 1) * quota.PAGE_SIZE
        rows = list(queryset[offset:offset + quota.PAGE_SIZE])
        quota.increment_search_count(request.user)
        locale = _locale(request.user)
        payload: dict[str, object] = {
            'results': [_people_row(person, locale) for person in rows],
        }
        payload.update(_truncated_payload(total, page, request.user))
        return Response(payload)


class CompanySearchView(APIView):
    def get(self, request: Request) -> Response:
        try:
            filters = parse_filters(
                request.query_params.get('filters'), include_company_fields=True
            )
            sort_field, direction = parse_sort(
                request.query_params.get('sort'), COMPANY_SORT_FIELDS
            )
            page = parse_page(request.query_params.get('page'))
        except ValidationError as exc:
            return _validation_response(exc)
        if (page - 1) * quota.PAGE_SIZE >= quota.MAX_NAVIGABLE_RESULTS:
            return _page_out_of_range()
        error = _quota_error(request.user)
        if error is not None:
            return error
        queryset = Company.objects.select_related('industry', 'wilaya_code').annotate(
            people_count=Count('people')
        )
        for condition in _company_conditions(filters):
            queryset = queryset.filter(condition)
        queryset = _order_by(queryset, sort_field, direction, _COMPANY_SORT)
        total = queryset.count()
        offset = (page - 1) * quota.PAGE_SIZE
        rows = list(queryset[offset:offset + quota.PAGE_SIZE])
        quota.increment_search_count(request.user)
        locale = _locale(request.user)
        payload: dict[str, object] = {
            'results': [_company_row(company, locale) for company in rows],
        }
        payload.update(_truncated_payload(total, page, request.user))
        return Response(payload)
