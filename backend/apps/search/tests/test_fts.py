import pytest
from django.db.models import Q, QuerySet
from django.db.models.expressions import RawSQL
from django.db.models.lookups import Lookup

from apps.search import search_index
from apps.search.fts import _sanitize_keyword, company_keyword_q, people_keyword_q
from apps.search.models import Company, Person

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema_user(create_user: object) -> object:
    return create_user


def _collect_raw_sqls(node: object) -> list[RawSQL]:
    if isinstance(node, RawSQL):
        return [node]
    if isinstance(node, Lookup):
        return _collect_raw_sqls(node.lhs) + _collect_raw_sqls(node.rhs)
    if isinstance(node, QuerySet):
        return _collect_raw_sqls(node.query.where)
    if isinstance(node, tuple) and len(node) == 2:
        return _collect_raw_sqls(node[1])
    if hasattr(node, 'children'):
        result: list[RawSQL] = []
        for child in node.children:
            result.extend(_collect_raw_sqls(child))
        return result
    return []


def _has_company_subquery(node: object) -> bool:
    if isinstance(node, Q):
        return any(_has_company_subquery(child) for child in node.children)
    if isinstance(node, tuple):
        return bool(node) and node[0] == 'company__in'
    return False


class TestSanitizeKeyword:
    def test_operators_are_removed(self) -> None:
        normalized = search_index.normalize_search('Café "Le Gérant" -Directeur')
        assert _sanitize_keyword(normalized) == 'cafe le gerant directeur'

    def test_whitespace_only_becomes_none(self) -> None:
        assert _sanitize_keyword('   ') is None

    def test_operator_only_becomes_none(self) -> None:
        assert _sanitize_keyword('- " *') is None

    def test_arabic_keyword_survives(self) -> None:
        normalized = search_index.normalize_search('شَرِكَةُ التِّجَارَة')
        assert _sanitize_keyword(normalized) == 'شركة التجارة'


class TestKeywordClauseEmpty:
    def test_none_keyword_yields_no_clause(self) -> None:
        assert people_keyword_q(None) is None
        assert company_keyword_q(None) is None

    def test_blank_keyword_yields_no_clause(self) -> None:
        assert people_keyword_q('   ') is None
        assert company_keyword_q('') is None


class TestSqliteKeywordBehavior:
    def test_keyword_matches_person_name(self, schema_user: object) -> None:
        company = Company.objects.create(name='SARL ÉLECTRICITÉ', source='test')
        Person.objects.create(name='Mohamed Amine', role='GÉRANT', company=company, source='test')
        Person.objects.create(name='Karim', role='Directeur', company=company, source='test')
        clause = people_keyword_q('mohamed')
        assert clause is not None
        matches = list(Person.objects.filter(clause).values_list('name', flat=True))
        assert matches == ['Mohamed Amine']

    def test_keyword_matches_role_diacritic_insensitive(self, schema_user: object) -> None:
        company = Company.objects.create(name='SARL ÉLECTRICITÉ', source='test')
        Person.objects.create(name='Mohamed Amine', role='GÉRANT', company=company, source='test')
        clause = people_keyword_q('gérant')
        assert clause is not None
        matches = list(Person.objects.filter(clause).values_list('name', flat=True))
        assert matches == ['Mohamed Amine']

    def test_keyword_matches_company_name_for_people(self, schema_user: object) -> None:
        company = Company.objects.create(name='SARL ÉLECTRICITÉ', source='test')
        Person.objects.create(name='Mohamed Amine', role='GÉRANT', company=company, source='test')
        clause = people_keyword_q('electricite')
        assert clause is not None
        matches = list(Person.objects.filter(clause).values_list('name', flat=True))
        assert matches == ['Mohamed Amine']

    def test_arabic_tashkeel_insensitive(self, schema_user: object) -> None:
        company = Company.objects.create(name='شركة التجارة', source='test')
        Person.objects.create(name='أمين محمود', role='مدير', company=company, source='test')
        clause = people_keyword_q('شَرِكَة')
        assert clause is not None
        assert list(Person.objects.filter(clause).values_list('name', flat=True)) == ['أمين محمود']

    def test_keyword_ands_with_structured_filter(self, schema_user: object) -> None:
        from apps.search.models import Wilaya

        wilaya31 = Wilaya.objects.get(code=31)
        wilaya16 = Wilaya.objects.get(code=16)
        company_a = Company.objects.create(name='Alpha SARL', wilaya_code=wilaya31, source='test')
        company_b = Company.objects.create(name='Alpha BTP', wilaya_code=wilaya16, source='test')
        Person.objects.create(name='Sofiane', role='Gérant', company=company_a, source='test')
        Person.objects.create(name='Sofiane', role='Gérant', company=company_b, source='test')
        clause = people_keyword_q('sofiane')
        assert clause is not None
        narrowed = Person.objects.filter(clause, company__wilaya_code=31)
        assert narrowed.count() == 1
        assert narrowed.get().company_id == company_a.id

    def test_company_keyword_matches_name_only(self, schema_user: object) -> None:
        company = Company.objects.create(name='SARL ÉLECTRICITÉ', source='test')
        other = Company.objects.create(name='BÂTIMENT BTP', source='test')
        Person.objects.create(name='Mohamed Amine', role='GÉRANT', company=company, source='test')
        clause = company_keyword_q('gerant')
        assert clause is not None
        assert set(Company.objects.filter(clause).values_list('name', flat=True)) == set()
        clause2 = company_keyword_q('electricite')
        assert clause2 is not None
        assert list(Company.objects.filter(clause2).values_list('id', flat=True)) == [company.id]
        assert other.id not in list(Company.objects.filter(clause2).values_list('id', flat=True))

    def test_no_keyword_returns_all(self, schema_user: object) -> None:
        company = Company.objects.create(name='SARL ÉLECTRICITÉ', source='test')
        Person.objects.create(name='Mohamed Amine', company=company, source='test')
        Person.objects.create(name='Karim', company=company, source='test')
        assert Person.objects.filter().count() == 2


class TestPostgresContract:
    def test_people_clause_uses_websearch_on_people_column(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from django.db import connection

        monkeypatch.setattr(connection, 'vendor', 'postgresql')
        clause = people_keyword_q('cafe')
        assert clause is not None
        raws = _collect_raw_sqls(clause)
        assert raws, 'expected at least one RawSQL in the people clause'
        expected = "people.search_vector @@ websearch_to_tsquery('simple', unaccent(%s))"
        assert any(expected == raw.sql for raw in raws)
        assert _has_company_subquery(clause)

    def test_people_clause_company_subquery_uses_companies_column(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from django.db import connection

        monkeypatch.setattr(connection, 'vendor', 'postgresql')
        clause = people_keyword_q('cafe')
        assert clause is not None
        raws = _collect_raw_sqls(clause)
        expected = "companies.search_vector @@ websearch_to_tsquery('simple', unaccent(%s))"
        assert any(expected == raw.sql for raw in raws)

    def test_company_clause_uses_companies_column(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from django.db import connection

        monkeypatch.setattr(connection, 'vendor', 'postgresql')
        clause = company_keyword_q('cafe')
        assert clause is not None
        raws = _collect_raw_sqls(clause)
        assert len(raws) == 1
        expected = "companies.search_vector @@ websearch_to_tsquery('simple', unaccent(%s))"
        assert expected == raws[0].sql

    def test_clauses_only_reference_main_tables(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from django.db import connection

        monkeypatch.setattr(connection, 'vendor', 'postgresql')
        for clause in (people_keyword_q('cafe'), company_keyword_q('cafe')):
            assert clause is not None
            for raw in _collect_raw_sqls(clause):
                assert raw.sql.startswith(('people.', 'companies.')), raw.sql
