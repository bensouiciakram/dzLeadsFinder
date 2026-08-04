from typing import Any

from django.db import migrations

_ADD_SEARCH_VECTOR_SQL = (
    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS search_vector tsvector "
    "GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED"
)
_ADD_GIN_INDEX_SQL = 'CREATE INDEX IF NOT EXISTS {index} ON {table} USING GIN (search_vector)'
_DROP_INDEX_SQL = 'DROP INDEX IF EXISTS {index}'
_DROP_COLUMN_SQL = 'ALTER TABLE {table} DROP COLUMN IF EXISTS search_vector'

_TABLES = (
    ('companies', 'companies_search_vector_gin'),
    ('people', 'people_search_vector_gin'),
)


def add_search_vector(apps: Any, schema_editor: Any) -> None:
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute('CREATE EXTENSION IF NOT EXISTS unaccent')
    for table, index in _TABLES:
        schema_editor.execute(_ADD_SEARCH_VECTOR_SQL.format(table=table))
        schema_editor.execute(_ADD_GIN_INDEX_SQL.format(table=table, index=index))


def remove_search_vector(apps: Any, schema_editor: Any) -> None:
    if schema_editor.connection.vendor != 'postgresql':
        return
    for table, index in _TABLES:
        schema_editor.execute(_DROP_INDEX_SQL.format(index=index))
        schema_editor.execute(_DROP_COLUMN_SQL.format(table=table))


class Migration(migrations.Migration):

    dependencies = [
        ('search', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_search_vector, remove_search_vector),
    ]
