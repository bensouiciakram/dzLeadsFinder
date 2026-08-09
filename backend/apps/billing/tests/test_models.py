"""Billing schema tests: subscriptions + payment_transactions tables, enums, idempotency guard."""


import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, models

from apps.accounts.models import TIER_CHOICES
from apps.billing.models import PaymentTransaction, Subscription

User = get_user_model()

pytestmark = pytest.mark.django_db

_SUBSCRIPTION_STATUSES = {
    'active',
    'failed_renewal',
    'cancelled',
    'expired',
}

_PAYMENT_STATUSES = {
    'pending',
    'succeeded',
    'failed',
    'refunded',
}

_PAYMENT_TYPES = {
    'subscription_creation',
    'subscription_renewal',
    'pack_purchase',
}


def _table_columns(table: str) -> set[str]:
    with connection.cursor() as cursor:
        description = connection.introspection.get_table_description(cursor, table)
    return {column.name for column in description}


class TestSubscriptionsSchema:
    def test_subscriptions_table_exists_with_expected_columns(self) -> None:
        columns = _table_columns('subscriptions')
        assert {
            'id',
            'user_id',
            'tier',
            'status',
            'current_period_start',
            'current_period_end',
            'chargily_subscription_id',
            'cancelled_at',
            'created_at',
        } <= columns

    def test_id_is_uuid_primary_key(self) -> None:
        field = Subscription._meta.get_field('id')
        assert isinstance(field, models.UUIDField)
        assert field.primary_key

    def test_user_field_references_auth_user_and_cascades(self) -> None:
        field = Subscription._meta.get_field('user')
        assert isinstance(field, models.ForeignKey)
        assert field.remote_field.model is User
        assert field.remote_field.on_delete is models.CASCADE
        assert not field.null

    def test_tier_reuses_accounts_tier_choices(self) -> None:
        field = Subscription._meta.get_field('tier')
        assert {value for value, _label in field.choices} == {
            value for value, _label in TIER_CHOICES
        }
        assert field.default == 'starter'

    def test_tier_check_constraint_enforced(self) -> None:
        user = User.objects.create_user(email='tier@example.com', password='SecurePass123!')
        with pytest.raises(IntegrityError):
            Subscription.objects.create(
                user=user,
                tier='platinum',
                current_period_start='2026-08-01T00:00:00Z',
                current_period_end='2026-09-01T00:00:00Z',
            )

    def test_status_choices_cover_all_subscription_statuses(self) -> None:
        choices = {value for value, _label in Subscription._meta.get_field('status').choices}
        assert choices == _SUBSCRIPTION_STATUSES

    def test_status_defaults_to_active(self) -> None:
        user = User.objects.create_user(email='status@example.com', password='SecurePass123!')
        row = Subscription.objects.create(
            user=user,
            current_period_start='2026-08-01T00:00:00Z',
            current_period_end='2026-09-01T00:00:00Z',
        )
        assert row.status == 'active'

    def test_status_check_constraint_enforced(self) -> None:
        user = User.objects.create_user(email='statusc@example.com', password='SecurePass123!')
        with pytest.raises(IntegrityError):
            Subscription.objects.create(
                user=user,
                status='trial',
                current_period_start='2026-08-01T00:00:00Z',
                current_period_end='2026-09-01T00:00:00Z',
            )

    def test_period_fields_required(self) -> None:
        user = User.objects.create_user(email='period@example.com', password='SecurePass123!')
        assert Subscription._meta.get_field('current_period_start').null is False
        assert Subscription._meta.get_field('current_period_end').null is False
        with pytest.raises(Exception):
            Subscription.objects.create(user=user)

    def test_optional_fields_are_nullable(self) -> None:
        assert Subscription._meta.get_field('chargily_subscription_id').null
        assert Subscription._meta.get_field('cancelled_at').null


class TestPaymentTransactionsSchema:
    def test_payment_transactions_table_exists_with_expected_columns(self) -> None:
        columns = _table_columns('payment_transactions')
        assert {
            'id',
            'user_id',
            'chargily_event_id',
            'type',
            'amount_dzd',
            'status',
            'credits_granted',
            'chargily_checkout_url',
            'chargily_metadata',
            'created_at',
            'reconciled_at',
        } <= columns

    def test_id_is_uuid_primary_key(self) -> None:
        field = PaymentTransaction._meta.get_field('id')
        assert isinstance(field, models.UUIDField)
        assert field.primary_key

    def test_user_field_references_auth_user_and_cascades(self) -> None:
        field = PaymentTransaction._meta.get_field('user')
        assert isinstance(field, models.ForeignKey)
        assert field.remote_field.model is User
        assert field.remote_field.on_delete is models.CASCADE
        assert not field.null

    def test_chargily_event_id_is_unique_not_null(self) -> None:
        field = PaymentTransaction._meta.get_field('chargily_event_id')
        assert field.unique
        assert not field.null
        assert not field.blank

    def test_type_choices_cover_all_payment_types(self) -> None:
        choices = {value for value, _label in PaymentTransaction._meta.get_field('type').choices}
        assert choices == _PAYMENT_TYPES

    def test_type_check_constraint_enforced(self) -> None:
        user = User.objects.create_user(email='type@example.com', password='SecurePass123!')
        with pytest.raises(IntegrityError):
            PaymentTransaction.objects.create(
                user=user,
                chargily_event_id='evt-bad-type',
                type='invoice',
                amount_dzd=1500,
            )

    def test_status_choices_cover_all_payment_statuses(self) -> None:
        choices = {value for value, _label in PaymentTransaction._meta.get_field('status').choices}
        assert choices == _PAYMENT_STATUSES

    def test_status_defaults_to_pending(self) -> None:
        user = User.objects.create_user(email='pstatus@example.com', password='SecurePass123!')
        row = PaymentTransaction.objects.create(
            user=user,
            chargily_event_id='evt-default-status',
            type='subscription_creation',
            amount_dzd=1500,
        )
        assert row.status == 'pending'

    def test_status_check_constraint_enforced(self) -> None:
        user = User.objects.create_user(email='pstatusc@example.com', password='SecurePass123!')
        with pytest.raises(IntegrityError):
            PaymentTransaction.objects.create(
                user=user,
                chargily_event_id='evt-bad-status',
                type='subscription_creation',
                amount_dzd=1500,
                status='on_hold',
            )

    def test_amount_is_required_integer(self) -> None:
        field = PaymentTransaction._meta.get_field('amount_dzd')
        assert isinstance(field, models.IntegerField)
        assert not field.null
        user = User.objects.create_user(email='amt@example.com', password='SecurePass123!')
        with pytest.raises(Exception):
            PaymentTransaction.objects.create(
                user=user,
                chargily_event_id='evt-no-amount',
                type='subscription_creation',
            )

    def test_optional_fields_are_nullable(self) -> None:
        assert PaymentTransaction._meta.get_field('credits_granted').null
        assert PaymentTransaction._meta.get_field('chargily_checkout_url').null
        assert PaymentTransaction._meta.get_field('chargily_metadata').null
        assert PaymentTransaction._meta.get_field('reconciled_at').null

    def test_metadata_is_json_field(self) -> None:
        assert isinstance(PaymentTransaction._meta.get_field('chargily_metadata'), models.JSONField)

    def test_composite_index_on_user_and_created_at_desc(self) -> None:
        index = next(
            i for i in PaymentTransaction._meta.indexes
            if i.name == 'payments_user_created_idx'
        )
        assert list(index.fields) == ['user', '-created_at']


class TestBillingModelLabels:
    def test_models_importable_via_apps_registry(self) -> None:
        assert apps.get_model('billing', 'Subscription') is Subscription
        assert apps.get_model('billing', 'PaymentTransaction') is PaymentTransaction

    def test_str_and_ordering_defined(self) -> None:
        assert Subscription._meta.ordering == ['-created_at']
        assert PaymentTransaction._meta.ordering == ['-created_at']
        user = User.objects.create_user(email='str@example.com', password='SecurePass123!')
        txn = PaymentTransaction.objects.create(
            user=user,
            chargily_event_id='evt-str',
            type='pack_purchase',
            amount_dzd=500,
        )
        assert str(txn)
        sub = Subscription.objects.create(
            user=user,
            current_period_start='2026-08-01T00:00:00Z',
            current_period_end='2026-09-01T00:00:00Z',
        )
        assert str(sub)
