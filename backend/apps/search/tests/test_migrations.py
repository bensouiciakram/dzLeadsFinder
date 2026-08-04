import importlib
import inspect
from types import ModuleType

from django.db import migrations


def _load_migration(name: str) -> ModuleType:
    return importlib.import_module(f'apps.search.migrations.{name}')


def _source(module: ModuleType) -> str:
    return inspect.getsource(module)


class TestPostgresTsVectorMigration:
    def test_migration_0002_exists_and_is_a_migration(self) -> None:
        module = _load_migration('0002_search_pg_tsvector')
        assert issubclass(module.Migration, migrations.Migration)

    def test_uses_vendor_guarded_runpython(self) -> None:
        source = _source(_load_migration('0002_search_pg_tsvector'))
        assert 'migrations.RunPython' in source
        assert "vendor != 'postgresql'" in source

    def test_enables_unaccent_extension(self) -> None:
        source = _source(_load_migration('0002_search_pg_tsvector'))
        assert 'CREATE EXTENSION IF NOT EXISTS unaccent' in source

    def test_generated_tsvector_column_for_companies(self) -> None:
        module = _load_migration('0002_search_pg_tsvector')
        assert module._ADD_SEARCH_VECTOR_SQL.format(table='companies') == (
            "ALTER TABLE companies ADD COLUMN search_vector tsvector "
            "GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED"
        )
        gin_sql = module._ADD_GIN_INDEX_SQL.format(
            table='companies',
            index='companies_search_vector_gin',
        )
        assert gin_sql == (
            'CREATE INDEX companies_search_vector_gin ON companies USING GIN (search_vector)'
        )

    def test_generated_tsvector_column_for_people(self) -> None:
        module = _load_migration('0002_search_pg_tsvector')
        assert module._ADD_SEARCH_VECTOR_SQL.format(table='people') == (
            "ALTER TABLE people ADD COLUMN search_vector tsvector "
            "GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED"
        )
        gin_sql = module._ADD_GIN_INDEX_SQL.format(
            table='people',
            index='people_search_vector_gin',
        )
        assert gin_sql == (
            'CREATE INDEX people_search_vector_gin ON people USING GIN (search_vector)'
        )

    def test_reverse_drops_column(self) -> None:
        source = _source(_load_migration('0002_search_pg_tsvector'))
        assert 'DROP COLUMN IF EXISTS search_vector' in source
        assert 'DROP INDEX IF EXISTS' in source
