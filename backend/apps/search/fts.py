"""Keyword full-text search clause construction, vendor-guarded.

On PostgreSQL the generated `search_vector` column is matched via
`websearch_to_tsquery('simple', unaccent(%s))`; raw clauses only ever
reference the queryset's own main table (joined tables use unstable
aliases). On SQLite (test DB) a normalized-icontains approximation is used.
"""

import re

from django.db import connection
from django.db.models import BooleanField, Q
from django.db.models.expressions import RawSQL

from apps.search import search_index
from apps.search.models import Company

_OPERATORS = re.compile(r'[^\w\s]')
_WHITESPACE = re.compile(r'\s+')


def _sanitize_keyword(normalized: str) -> str | None:
    cleaned = _WHITESPACE.sub(' ', _OPERATORS.sub(' ', normalized)).strip()
    return cleaned or None


def _fts_clause(table: str, keyword: str) -> RawSQL:
    return RawSQL(
        f"{table}.search_vector @@ websearch_to_tsquery('simple', unaccent(%s))",
        (keyword,),
        output_field=BooleanField(),
    )


def _normalized_keyword(keyword: str | None) -> str | None:
    if keyword is None:
        return None
    return _sanitize_keyword(search_index.normalize_search(keyword))


def people_keyword_q(keyword: str | None) -> Q | None:
    sanitized = _normalized_keyword(keyword)
    if sanitized is None:
        return None
    if connection.vendor == 'postgresql':
        company_clause = Q(company__in=Company.objects.filter(_fts_clause('companies', sanitized)))
        return Q(_fts_clause('people', sanitized)) | company_clause
    return Q(search_normalized__icontains=sanitized) | Q(
        company__search_normalized__icontains=sanitized
    )


def company_keyword_q(keyword: str | None) -> Q | None:
    sanitized = _normalized_keyword(keyword)
    if sanitized is None:
        return None
    if connection.vendor == 'postgresql':
        return Q(_fts_clause('companies', sanitized))
    return Q(search_normalized__icontains=sanitized)
