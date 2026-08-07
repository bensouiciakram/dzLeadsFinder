"""Schema tests for the exports table (the 4.1 test_models.py precedent).

Pins the spine DDL (ARCHITECTURE-SPINE.md#L225-235) + the 4.4 extensions
(rows_json snapshot + frozen locale) as Django model semantics.
"""

from collections.abc import Callable

import pytest
from django.contrib.auth import get_user_model
from django.db import models

from apps.exports.models import Export

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def make_user(db: object) -> Callable[[], object]:
    counter = {'n': 0}

    def _make_user() -> object:
        counter['n'] += 1
        return User.objects.create_user(
            email=f'export-test-{counter["n"]}@example.com',
            password='SecurePass123!',
            locale='en',
        )

    return _make_user


@pytest.fixture
def user_with_exports(make_user: Callable[[], object]) -> object:
    user = make_user()
    Export.objects.create(
        user=user,
        format='csv',
        row_count=2,
        credits_cost=2,
        included_unrevealed=True,
        locale='en',
        rows_json={'record_type': 'people', 'rows': []},
    )
    return user


def _field(model_cls: type[models.Model], name: str) -> models.Field:
    return model_cls._meta.get_field(name)


class TestSchema:
    def test_export_model_importable(self) -> None:
        assert Export.__name__ == 'Export'
        assert Export._meta.label == 'exports.Export'

    def test_db_table(self) -> None:
        assert Export._meta.db_table == 'exports'

    def test_columns(self) -> None:
        names = {field.name for field in Export._meta.fields}
        assert names == {
            'id',
            'user',
            'format',
            'row_count',
            'credits_cost',
            'included_unrevealed',
            'watermark',
            'created_at',
            'rows_json',
            'locale',
        }

    def test_user_fk_cascade(self) -> None:
        field = _field(Export, 'user')
        assert field.is_relation
        assert field.null is False
        assert field.remote_field.on_delete.__name__ == 'CASCADE'

    def test_format_choices(self) -> None:
        choices = dict(_field(Export, 'format').choices)
        assert set(choices) == {'csv', 'xlsx'}

    def test_defaults(self) -> None:
        assert _field(Export, 'included_unrevealed').default is True
        assert _field(Export, 'watermark').default is False
        assert _field(Export, 'locale').null is False

    def test_rows_json_default(self) -> None:
        assert _field(Export, 'rows_json').default is dict

    def test_check_constraints(self) -> None:
        names = {constraint.name for constraint in Export._meta.constraints}
        assert names >= {
            'exports_format_check',
            'exports_row_count_non_negative',
            'exports_credits_cost_non_negative',
        }

    def test_composite_index(self) -> None:
        names = {index.name for index in Export._meta.indexes}
        assert 'exports_user_created_idx' in names

    def test_ordering(self) -> None:
        assert Export._meta.ordering == ['-created_at']


class TestBehavior:
    def test_row_created_with_defaults(self, make_user: Callable[[], object]) -> None:
        user = make_user()
        export = Export.objects.create(
            user=user,
            format='xlsx',
            row_count=1,
            credits_cost=1,
            locale='ar',
        )
        assert export.watermark is False
        assert export.included_unrevealed is True
        assert export.rows_json == {}
        assert export.created_at is not None

    def test_ordering_newest_first(self, user_with_exports: object) -> None:
        user = user_with_exports
        older = Export.objects.filter(user=user).first()
        assert older is not None
        Export.objects.filter(pk=older.pk).update(created_at='2026-01-01T00:00:00+00:00')
        newer = Export.objects.create(
            user=user,
            format='csv',
            row_count=1,
            credits_cost=1,
            locale='en',
        )
        rows = list(Export.objects.filter(user=user))
        assert [r.pk for r in rows] == [newer.pk, older.pk]
