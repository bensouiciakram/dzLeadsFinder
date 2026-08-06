"""SavedSearch model tests: spine DDL contract (saved_searches table)."""

from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.utils import timezone

from apps.search.models import SavedSearch

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema_user(create_user: object) -> object:
    return create_user


def _saved_search(
    user: Any, *, name: str = 'Importers Oran', search_type: str = 'people'
) -> Any:
    return SavedSearch.objects.create(
        user=user,
        name=name,
        type=search_type,
        filters={'industry': [2], 'wilaya': [31], 'keyword': 'textile'},
        sort={'field': 'role', 'dir': 'desc'},
    )


class TestTableContract:
    def test_saved_searches_table_exists(self) -> None:
        tables = connection.introspection.table_names()
        assert 'saved_searches' in tables

    def test_saved_searches_columns_match_spine(self) -> None:
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(
                cursor, 'saved_searches'
            )
        columns = {column.name: column for column in description}
        expected = {
            'id',
            'user_id',
            'name',
            'type',
            'filters',
            'sort',
            'created_at',
            'updated_at',
        }
        assert expected <= set(columns)

    def test_db_table_matches_spine(self) -> None:
        assert SavedSearch._meta.db_table == 'saved_searches'


class TestFields:
    def test_creates_with_defaults(self, schema_user: Any) -> None:
        row = SavedSearch.objects.create(user=schema_user, name='x', type='people')
        assert row.filters == {}
        assert row.sort is None
        assert row.created_at is not None
        assert row.updated_at is not None

    def test_type_choices_are_singular_values(self) -> None:
        choices = {value for value, _label in SavedSearch._meta.get_field('type').choices or []}
        assert choices == {'people', 'company'}

    def test_type_rejects_plural_value(self, schema_user: Any) -> None:
        with pytest.raises(Exception):
            SavedSearch.objects.create(user=schema_user, name='x', type='companies')

    def test_type_check_constraint_exists(self) -> None:
        constraints = {c.name for c in SavedSearch._meta.constraints}
        assert 'saved_searches_type_check' in constraints

    def test_user_related_name(self) -> None:
        assert SavedSearch._meta.get_field('user').related_query_name() == 'saved_searches'

    def test_user_cascade_delete(self, schema_user: Any) -> None:
        row = _saved_search(schema_user)
        schema_user.delete()
        assert not SavedSearch.objects.filter(pk=row.pk).exists()

    def test_updated_at_bumps_on_save(self, schema_user: Any) -> None:
        row = _saved_search(schema_user)
        before = row.updated_at
        row.name = 'renamed'
        row.save()
        row.refresh_from_db()
        assert row.updated_at >= before
        assert row.name == 'renamed'
        assert row.filters == {'industry': [2], 'wilaya': [31], 'keyword': 'textile'}
        assert row.sort == {'field': 'role', 'dir': 'desc'}

    def test_str_renders_name(self, schema_user: Any) -> None:
        assert str(_saved_search(schema_user)) == 'Importers Oran'


class TestQueries:
    def test_latest_first_ordering(self, schema_user: Any) -> None:
        older = _saved_search(schema_user, name='older')
        _saved_search(schema_user, name='newer')
        older.created_at = timezone.now() - timezone.timedelta(minutes=1)
        older.save(update_fields=['created_at'])
        rows = SavedSearch.objects.order_by('-created_at')
        assert list(rows.values_list('name', flat=True)) == ['newer', 'older']
