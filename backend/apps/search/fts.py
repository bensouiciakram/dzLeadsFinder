"""Keyword full-text search clause construction, vendor-guarded.

On PostgreSQL the generated `search_vector` column is matched via
`plainto_tsquery('simple', unaccent(%s))` — literal word-AND semantics with
no tsquery operator parsing (FR-13 is plain free text); raw clauses only
ever reference the queryset's own main table (joined tables use unstable
aliases). On SQLite (test DB) a normalized AND-of-tokens icontains
approximation is used.
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
        f"{table}.search_vector @@ plainto_tsquery('simple', unaccent(%s))",
        (keyword,),
        output_field=BooleanField(),
    )


def _normalized_keyword(keyword: str | None) -> str | None:
    if keyword is None:
        return None
    return _sanitize_keyword(search_index.normalize_search(keyword))


def _sqlite_keyword_q(keyword: str, *, include_company: bool) -> Q:
    result = Q()
    for token in keyword.split(' '):
        token_clause = Q(search_normalized__icontains=token)
        if include_company:
            token_clause = token_clause | Q(company__search_normalized__icontains=token)
        result = result & token_clause
    return result


def people_keyword_q(keyword: str | None) -> Q | None:
    sanitized = _normalized_keyword(keyword)
    if sanitized is None:
        return None
    if connection.vendor == 'postgresql':
        company_clause = Q(company__in=Company.objects.filter(_fts_clause('companies', sanitized)))
        return Q(_fts_clause('people', sanitized)) | company_clause
    return _sqlite_keyword_q(sanitized, include_company=True)


def company_keyword_q(keyword: str | None) -> Q | None:
    sanitized = _normalized_keyword(keyword)
    if sanitized is None:
        return None
    if connection.vendor == 'postgresql':
        return Q(_fts_clause('companies', sanitized))
    return _sqlite_keyword_q(sanitized, include_company=False)
