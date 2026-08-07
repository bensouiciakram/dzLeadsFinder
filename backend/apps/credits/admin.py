"""Append-only admin surfaces for the credit ledger and reveals (audit)."""

from django.contrib import admin

from .models import CreditLedger, Reveal


@admin.register(CreditLedger)
class CreditLedgerAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'event_type',
        'amount',
        'balance_after',
        'pool',
        'reference_id',
        'created_at',
    )
    list_filter = ('event_type', 'pool')
    search_fields = ('user__email', 'reference_id')
    readonly_fields = [field.name for field in CreditLedger._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object | None = None) -> bool:
        return False

    def has_delete_permission(self, request: object, obj: object | None = None) -> bool:
        return False


@admin.register(Reveal)
class RevealAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'record_type',
        'record_id',
        'credit_cost',
        'was_free',
        'created_at',
    )
    list_filter = ('record_type', 'was_free')
    search_fields = ('user__email', 'record_id')
    readonly_fields = [field.name for field in Reveal._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object | None = None) -> bool:
        return False

    def has_delete_permission(self, request: object, obj: object | None = None) -> bool:
        return False
