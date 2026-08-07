"""Read-only admin surface for the exports table (the 4.1 credits admin
precedent — exports are charged artifacts, append-only)."""

from typing import Any

from django.contrib import admin

import apps.exports.admin  # noqa: F401  (registers the admin)
from apps.exports.models import Export


def _fields(model: Any) -> list[str]:
    return [field.name for field in model._meta.fields]


class TestExportAdmin:
    def test_registered(self) -> None:
        assert admin.site._registry.get(Export) is not None

    def test_every_model_field_is_readonly(self) -> None:
        registered = admin.site._registry[Export]
        assert set(registered.readonly_fields) == set(_fields(Export))

    def test_append_only_permissions(self) -> None:
        registered = admin.site._registry[Export]
        assert registered.has_add_permission(admin.site) is False
        assert registered.has_change_permission(admin.site) is False
        assert registered.has_delete_permission(admin.site) is False

    def test_list_display_covers_audit_columns(self) -> None:
        registered = admin.site._registry[Export]
        assert set(registered.list_display) >= {
            'user', 'format', 'row_count', 'credits_cost', 'watermark', 'created_at',
        }
