import importlib
import inspect
import types
from types import ModuleType
from typing import Any

from django.db import migrations


def _load_migration(name: str) -> ModuleType:
    return importlib.import_module(f'apps.search.migrations.{name}')


def _source(module: ModuleType) -> str:
    return inspect.getsource(module)


def _make_editor(vendor: str) -> Any:
    statements: list[str] = []
    return types.SimpleNamespace(
        connection=types.SimpleNamespace(vendor=vendor),
        statements=statements,
        execute=lambda sql: statements.append(sql),
    )


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
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS search_vector tsvector "
            "GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED"
        )
        gin_sql = module._ADD_GIN_INDEX_SQL.format(
            table='companies',
            index='companies_search_vector_gin',
        )
        assert gin_sql == (
            'CREATE INDEX IF NOT EXISTS companies_search_vector_gin '
            'ON companies USING GIN (search_vector)'
        )

    def test_generated_tsvector_column_for_people(self) -> None:
        module = _load_migration('0002_search_pg_tsvector')
        assert module._ADD_SEARCH_VECTOR_SQL.format(table='people') == (
            "ALTER TABLE people ADD COLUMN IF NOT EXISTS search_vector tsvector "
            "GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED"
        )
        gin_sql = module._ADD_GIN_INDEX_SQL.format(
            table='people',
            index='people_search_vector_gin',
        )
        assert gin_sql == (
            'CREATE INDEX IF NOT EXISTS people_search_vector_gin '
            'ON people USING GIN (search_vector)'
        )

    def test_reverse_drops_column(self) -> None:
        source = _source(_load_migration('0002_search_pg_tsvector'))
        assert 'DROP COLUMN IF EXISTS search_vector' in source
        assert 'DROP INDEX IF EXISTS' in source


class TestPostgresTsVectorBehavior:
    def test_add_search_vector_executes_full_ddl_sequence(self) -> None:
        module = _load_migration('0002_search_pg_tsvector')
        editor = _make_editor('postgresql')
        module.add_search_vector(None, editor)
        assert editor.statements == [
            'CREATE EXTENSION IF NOT EXISTS unaccent',
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS search_vector tsvector "
            "GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED",
            'CREATE INDEX IF NOT EXISTS companies_search_vector_gin '
            'ON companies USING GIN (search_vector)',
            "ALTER TABLE people ADD COLUMN IF NOT EXISTS search_vector tsvector "
            "GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED",
            'CREATE INDEX IF NOT EXISTS people_search_vector_gin '
            'ON people USING GIN (search_vector)',
        ]

    def test_remove_search_vector_executes_reverse_ddl(self) -> None:
        module = _load_migration('0002_search_pg_tsvector')
        editor = _make_editor('postgresql')
        module.remove_search_vector(None, editor)
        assert editor.statements == [
            'DROP INDEX IF EXISTS companies_search_vector_gin',
            'ALTER TABLE companies DROP COLUMN IF EXISTS search_vector',
            'DROP INDEX IF EXISTS people_search_vector_gin',
            'ALTER TABLE people DROP COLUMN IF EXISTS search_vector',
        ]

    def test_vendor_guard_noops_on_sqlite(self) -> None:
        module = _load_migration('0002_search_pg_tsvector')
        editor = _make_editor('sqlite')
        module.add_search_vector(None, editor)
        module.remove_search_vector(None, editor)
        assert editor.statements == []
