"""Search API endpoint views for People and Company search."""

from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Case, Count, F, IntegerField, Q, Value, When
from django.db.models.expressions import Expression
from django.db.models.query import QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.credits.models import RECORD_TYPE_COMPANY, RECORD_TYPE_PEOPLE, Reveal
from apps.credits.services import RE_REVEAL_WINDOW_DAYS
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
from apps.search.models import Company, Person, SavedSearch
from apps.search.serializers import SavedSearchSerializer

_PEOPLE_SORT: dict[str, str] = {
    'name': 'name',
    'role': 'role',
    'company_name': 'company__name',
    'wilaya_code': 'company__wilaya_code',
}

_COMPANY_SORT: dict[str, str] = {
    'name': 'name',
    'industry': 'industry__name_en',
    'size_band': 'size_band',
    'wilaya_code': 'wilaya_code',
    'people_count': 'people_count',
}

_SIZE_BAND_ORDER = Case(
    *[When(size_band=band, then=Value(index)) for index, band in enumerate(SIZE_BANDS, start=1)],
    default=None,
    output_field=IntegerField(),
)


def _revealed_ids(user: object, record_type: str, rows: list[object]) -> set[str]:
    """Record ids revealed within the re-reveal window (any row — paid or free).

    The window length is THE rule from credits.services (RE_REVEAL_WINDOW_DAYS)
    — the same constant that gates the free re-reveal path, so the search
    flag and the debit can never disagree.
    """
    if not rows:
        return set()
    ids = [str(getattr(row, 'id')) for row in rows]
    return set(
        Reveal.objects.filter(
            user_id=getattr(user, 'id'),
            record_type=record_type,
            record_id__in=ids,
            created_at__gte=timezone.now() - timedelta(days=RE_REVEAL_WINDOW_DAYS),
        ).values_list('record_id', flat=True)
    )


def _quota_error(user: Any) -> Response | None:
    if not quota.daily_limit_reached(user):
        return None
    limit = quota.daily_limit_for(user)
    message = quota.SEARCH_LIMIT_MESSAGES[user.effective_locale].format(limit=limit)
    return Response(
        {'detail': message, 'code': 'search_limit_exceeded', 'limit': limit}, status=429
    )


def _order_by(qs: QuerySet, field: str, direction: str, sort_map: dict[str, str]) -> QuerySet:
    key = sort_map[field]
    expression: Expression = _SIZE_BAND_ORDER if key == 'size_band' else F(key)
    if direction == 'desc':
        return qs.order_by(expression.desc(nulls_last=True), 'id')
    return qs.order_by(expression.asc(nulls_last=True), 'id')


def _truncated_payload(total: int, page: int, user: Any) -> dict[str, object]:
    truncated = total > quota.MAX_NAVIGABLE_RESULTS
    return {
        'total': total,
        'page': page,
        'truncated': truncated,
        'refine_prompt': quota.REFINE_PROMPT_MESSAGES[user.effective_locale] if truncated else None,
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


def _people_row(person: Person, locale: str, revealed_ids: set[str]) -> dict[str, object]:
    company = person.company
    wilaya = company.wilaya_code if company is not None else None
    return {
        'id': str(person.id),
        'name': person.name,
        'role': person.role,
        'company_name': (company.name or None) if company is not None else None,
        'company_id': str(company.id) if company is not None else None,
        'wilaya_code': wilaya.code if wilaya is not None else None,
        'wilaya_name': getattr(wilaya, f'name_{locale}') if wilaya is not None else None,
        'revealed': str(person.id) in revealed_ids,
    }


def _company_row(company: Company, locale: str, revealed_ids: set[str]) -> dict[str, object]:
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
        'revealed': str(company.id) in revealed_ids,
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
        locale = request.user.effective_locale
        revealed_ids = _revealed_ids(request.user, RECORD_TYPE_PEOPLE, rows)
        payload: dict[str, object] = {
            'results': [_people_row(person, locale, revealed_ids) for person in rows],
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
        locale = request.user.effective_locale
        revealed_ids = _revealed_ids(request.user, RECORD_TYPE_COMPANY, rows)
        payload: dict[str, object] = {
            'results': [_company_row(company, locale, revealed_ids) for company in rows],
        }
        payload.update(_truncated_payload(total, page, request.user))
        return Response(payload)


class SavedSearchListView(APIView):
    def get(self, request: Request) -> Response:
        rows = SavedSearch.objects.filter(user_id=request.user.id).order_by('-created_at')
        return Response(SavedSearchSerializer(rows, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = SavedSearchSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_response(ValidationError(serializer.errors))
        limit = quota.saved_search_limit_for(request.user)
        # Lock the user row so concurrent creates (two tabs) serialize on the
        # count-then-insert — the cap can never be exceeded by a burst.
        with transaction.atomic():
            locked_user = get_user_model().objects.select_for_update().get(
                pk=request.user.id
            )
            count = SavedSearch.objects.filter(user_id=locked_user.id).count()
            if count >= limit:
                message = quota.SAVED_SEARCH_LIMIT_MESSAGES[request.user.effective_locale].format(
                    limit=limit
                )
                return Response(
                    {
                        'detail': message,
                        'code': 'saved_search_limit_exceeded',
                        'limit': limit,
                    },
                    status=400,
                )
            serializer.save(user=locked_user)
        return Response(serializer.data, status=201)


class SavedSearchDetailView(APIView):
    def _row(self, request: Request, pk: str) -> SavedSearch:
        row = get_object_or_404(
            SavedSearch.objects.filter(user_id=request.user.id), pk=pk
        )
        assert isinstance(row, SavedSearch)
        return row

    def put(self, request: Request, pk: str) -> Response:
        row = self._row(request, pk)
        serializer = SavedSearchSerializer(row, data=request.data, partial=True)
        if not serializer.is_valid():
            return _validation_response(ValidationError(serializer.errors))
        serializer.save()
        return Response(serializer.data)

    def delete(self, request: Request, pk: str) -> Response:
        row = self._row(request, pk)
        row.delete()
        return Response(status=204)


class ChecklistView(APIView):
    def _state(self, request: Request) -> dict[str, object]:
        from apps.exports.models import Export
        from apps.search.models import DailyUsage

        searched_ever = DailyUsage.objects.filter(
            user_id=request.user.id, search_count__gt=0
        ).exists()
        revealed_ever = Reveal.objects.filter(user_id=request.user.id).exists()
        return {
            'step_search': searched_ever,
            # Cumulative first-ever semantics (John PM2): any reveal row
            # counts — no 30-day window on the journey step.
            'step_reveal': revealed_ever,
            # Epic-4 contract (3.7 deferred-work entry (b)): the exports
            # table EXISTS extension — cumulative first-ever, mirroring
            # step_reveal. The client contract does not change.
            'step_export': Export.objects.filter(user_id=request.user.id).exists(),
            'dismissed': request.user.checklist_dismissed_at is not None,
        }

    def get(self, request: Request) -> Response:
        return Response(self._state(request))

    def put(self, request: Request) -> Response:
        data = request.data if isinstance(request.data, dict) else None
        # Strict: exactly {"dismissed": true} — Python `==` would admit
        # {"dismissed": 1} (1 == True), so compare keys and identity.
        if data is None or data.keys() != {'dismissed'} or data['dismissed'] is not True:
            return Response(
                {'detail': 'Only {"dismissed": true} is accepted.', 'code': 'invalid_payload'},
                status=400,
            )
        get_user_model().objects.filter(pk=request.user.id).update(
            checklist_dismissed_at=timezone.now()
        )
        request.user.checklist_dismissed_at = timezone.now()
        return Response(self._state(request))


class CreditsBannerView(APIView):
    """The 15-credit welcome banner dismissal (4.3 — deferred-work 3.7 entry).

    Mirrors the 3.7 checklist dismissal contract verbatim: a nullable
    timestamp on the user + a strict PUT accepting exactly
    {'dismissed': True}. The banner's visibility is otherwise derived
    client-side (tier + live balance) — no backend trigger state.
    """

    def get(self, request: Request) -> Response:
        return Response({'dismissed': request.user.credits_banner_dismissed_at is not None})

    def put(self, request: Request) -> Response:
        data = request.data if isinstance(request.data, dict) else None
        if data is None or data.keys() != {'dismissed'} or data['dismissed'] is not True:
            return Response(
                {'detail': 'Only {"dismissed": true} is accepted.', 'code': 'invalid_payload'},
                status=400,
            )
        get_user_model().objects.filter(pk=request.user.id).update(
            credits_banner_dismissed_at=timezone.now()
        )
        request.user.credits_banner_dismissed_at = timezone.now()
        return Response({'dismissed': True})
