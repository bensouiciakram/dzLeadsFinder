"""Admin surface tests: billing rows are append-only audit surfaces (financial rows)."""


import pytest
from django.contrib import admin

from apps.billing.models import PaymentTransaction, Subscription

pytestmark = pytest.mark.django_db


def _get_admin(model: object) -> admin.ModelAdmin:
    return admin.site._registry[model]


class TestSubscriptionAdmin:
    def test_registered(self) -> None:
        assert Subscription in admin.site._registry

    def test_readonly_fields_cover_all_fields(self) -> None:
        model_admin = _get_admin(Subscription)
        field_names = {field.name for field in Subscription._meta.fields}
        assert set(model_admin.readonly_fields) == field_names

    def test_list_display_includes_financial_columns(self) -> None:
        model_admin = _get_admin(Subscription)
        assert {'user', 'tier', 'status', 'created_at'} <= set(model_admin.list_display)

    def test_append_only_permissions(self) -> None:
        model_admin = _get_admin(Subscription)
        assert model_admin.has_add_permission(None) is False
        assert model_admin.has_change_permission(None) is False
        assert model_admin.has_delete_permission(None) is False


class TestPaymentTransactionAdmin:
    def test_registered(self) -> None:
        assert PaymentTransaction in admin.site._registry

    def test_readonly_fields_cover_all_fields(self) -> None:
        model_admin = _get_admin(PaymentTransaction)
        field_names = {field.name for field in PaymentTransaction._meta.fields}
        assert set(model_admin.readonly_fields) == field_names

    def test_list_display_includes_financial_columns(self) -> None:
        model_admin = _get_admin(PaymentTransaction)
        assert {
            'user',
            'chargily_event_id',
            'type',
            'amount_dzd',
            'status',
            'created_at',
        } <= set(model_admin.list_display)

    def test_append_only_permissions(self) -> None:
        model_admin = _get_admin(PaymentTransaction)
        assert model_admin.has_add_permission(None) is False
        assert model_admin.has_change_permission(None) is False
        assert model_admin.has_delete_permission(None) is False
