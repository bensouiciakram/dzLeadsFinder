"""Read-only admin for the exports table (the 4.1 credits admin precedent).

Exports are charged artifacts — the ledger is the audit surface, admin
edits would corrupt the pricing record. Append-only.
"""

from django.contrib import admin

from apps.exports.models import Export


@admin.register(Export)
class ExportAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'format',
        'row_count',
        'credits_cost',
        'included_unrevealed',
        'watermark',
        'created_at',
    )
    list_filter = ('format', 'watermark')
    search_fields = ('user__email',)
    readonly_fields = [field.name for field in Export._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object | None = None) -> bool:
        return False

    def has_delete_permission(self, request: object, obj: object | None = None) -> bool:
        return False
