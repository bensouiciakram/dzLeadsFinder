"""Read-only admin surface for the credit ledger and reveals (audit AC)."""

from typing import Any

from django.contrib import admin

import apps.credits.admin  # noqa: F401  (registers the admins)
from apps.credits.models import CreditLedger, Reveal


def _fields(model: Any) -> list[str]:
    return [field.name for field in model._meta.fields]


class TestCreditLedgerAdmin:
    def test_registered(self) -> None:
        registered = admin.site._registry.get(CreditLedger)
        assert registered is not None

    def test_every_model_field_is_readonly(self) -> None:
        registered = admin.site._registry[CreditLedger]
        assert set(registered.readonly_fields) == set(_fields(CreditLedger))

    def test_append_only_permissions(self) -> None:
        registered = admin.site._registry[CreditLedger]
        assert registered.has_add_permission(admin.site) is False
        assert registered.has_change_permission(admin.site) is False
        assert registered.has_delete_permission(admin.site) is False

    def test_list_display_covers_audit_columns(self) -> None:
        registered = admin.site._registry[CreditLedger]
        assert set(registered.list_display) >= {
            'user', 'event_type', 'amount', 'balance_after', 'pool', 'created_at',
        }


class TestRevealAdmin:
    def test_registered(self) -> None:
        assert admin.site._registry.get(Reveal) is not None

    def test_every_model_field_is_readonly(self) -> None:
        registered = admin.site._registry[Reveal]
        assert set(registered.readonly_fields) == set(_fields(Reveal))

    def test_append_only_permissions(self) -> None:
        registered = admin.site._registry[Reveal]
        assert registered.has_add_permission(admin.site) is False
        assert registered.has_change_permission(admin.site) is False
        assert registered.has_delete_permission(admin.site) is False

    def test_list_display_covers_audit_columns(self) -> None:
        registered = admin.site._registry[Reveal]
        assert set(registered.list_display) >= {
            'user', 'record_type', 'record_id', 'was_free', 'created_at',
        }
