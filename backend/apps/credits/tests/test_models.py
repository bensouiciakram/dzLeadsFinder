"""Credit system schema tests: credit_ledger + reveals tables, enums, partial index."""


import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, models
from django.db.models import Q

from apps.credits.models import CreditLedger, Reveal

User = get_user_model()

pytestmark = pytest.mark.django_db

_CREDIT_EVENT_TYPES = {
    'free_signup',
    'subscription_grant',
    'pack_grant',
    'promotional_grant',
    'reveal_debit',
    'export_row_debit',
    'expiry',
}


def _table_columns(table: str) -> set[str]:
    with connection.cursor() as cursor:
        description = connection.introspection.get_table_description(cursor, table)
    return {column.name for column in description}


class TestCreditLedgerSchema:
    def test_credit_ledger_table_exists_with_expected_columns(self) -> None:
        columns = _table_columns('credit_ledger')
        assert {
            'id',
            'user_id',
            'event_type',
            'amount',
            'balance_after',
            'pool',
            'reference_id',
            'description',
            'created_at',
        } <= columns

    def test_user_field_is_nullable_set_null(self) -> None:
        field = CreditLedger._meta.get_field('user')
        assert isinstance(field, models.ForeignKey)
        assert field.null
        assert field.blank
        assert field.remote_field.on_delete is models.SET_NULL

    def test_event_type_choices_cover_all_credit_events(self) -> None:
        choices = {value for value, _label in CreditLedger._meta.get_field('event_type').choices}
        assert choices == _CREDIT_EVENT_TYPES

    def test_event_type_check_constraint_enforced(self) -> None:
        names = {constraint.name for constraint in CreditLedger._meta.constraints}
        check = next(
            c for c in CreditLedger._meta.constraints
            if isinstance(c, models.CheckConstraint) and 'event' in c.name
        )
        assert check.name in names
        user = User.objects.create_user(email='ledger@example.com', password='SecurePass123!')
        with pytest.raises(IntegrityError):
            CreditLedger.objects.create(
                user=user,
                event_type='not_an_event',
                amount=1,
                balance_after=1,
            )

    def test_pool_check_constraint_allows_only_subscription_and_pack(self) -> None:
        user = User.objects.create_user(email='pool@example.com', password='SecurePass123!')
        with pytest.raises(IntegrityError):
            CreditLedger.objects.create(
                user=user,
                event_type='free_signup',
                amount=15,
                balance_after=15,
                pool='voucher',
            )

    def test_pool_defaults_to_subscription(self) -> None:
        user = User.objects.create_user(email='pooldef@example.com', password='SecurePass123!')
        row = CreditLedger.objects.create(
            user=user,
            event_type='free_signup',
            amount=15,
            balance_after=15,
        )
        assert row.pool == 'subscription'

    def test_model_importable_via_apps_registry(self) -> None:
        assert apps.get_model('credits', 'CreditLedger') is CreditLedger
        assert apps.get_model('credits', 'Reveal') is Reveal


class TestRevealsSchema:
    def test_reveals_table_exists_with_expected_columns(self) -> None:
        columns = _table_columns('reveals')
        assert {
            'id',
            'user_id',
            'record_type',
            'record_id',
            'credit_cost',
            'was_free',
            'created_at',
        } <= columns

    def test_user_field_cascades(self) -> None:
        field = Reveal._meta.get_field('user')
        assert isinstance(field, models.ForeignKey)
        assert field.remote_field.on_delete is models.CASCADE

    def test_record_type_check_constraint_enforced(self) -> None:
        user = User.objects.create_user(email='reveal@example.com', password='SecurePass123!')
        with pytest.raises(IntegrityError):
            Reveal.objects.create(
                user=user,
                record_type='product',
                record_id='some-id',
            )

    def test_credit_cost_defaults_to_one(self) -> None:
        user = User.objects.create_user(email='cost@example.com', password='SecurePass123!')
        row = Reveal.objects.create(user=user, record_type='people', record_id='p-1')
        assert row.credit_cost == 1
        assert row.was_free is False

    def test_partial_unique_index_blocks_duplicate_paid_reveal(self) -> None:
        user = User.objects.create_user(email='dup@example.com', password='SecurePass123!')
        Reveal.objects.create(user=user, record_type='people', record_id='p-1', was_free=False)
        with pytest.raises(IntegrityError):
            Reveal.objects.create(user=user, record_type='people', record_id='p-1', was_free=False)

    def test_partial_unique_index_allows_free_reveal_twin(self) -> None:
        user = User.objects.create_user(email='twin@example.com', password='SecurePass123!')
        Reveal.objects.create(user=user, record_type='people', record_id='p-1', was_free=False)
        Reveal.objects.create(user=user, record_type='people', record_id='p-1', was_free=True)
        assert Reveal.objects.filter(user=user, record_id='p-1').count() == 2

    def test_partial_unique_index_allows_same_record_for_another_user(self) -> None:
        user_a = User.objects.create_user(email='a@example.com', password='SecurePass123!')
        user_b = User.objects.create_user(email='b@example.com', password='SecurePass123!')
        Reveal.objects.create(user=user_a, record_type='people', record_id='p-1', was_free=False)
        Reveal.objects.create(user=user_b, record_type='people', record_id='p-1', was_free=False)

    def test_meta_declares_partial_unique_constraint(self) -> None:
        constraint = next(
            c for c in Reveal._meta.constraints
            if isinstance(c, models.UniqueConstraint) and c.condition is not None
        )
        assert tuple(constraint.fields) == ('user', 'record_type', 'record_id')
        assert constraint.condition == Q(was_free=False)
