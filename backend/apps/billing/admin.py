"""Append-only admin surfaces for billing rows (financial audit)."""

from django.contrib import admin

from .models import PaymentTransaction, Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'tier',
        'status',
        'current_period_start',
        'current_period_end',
        'chargily_subscription_id',
        'cancelled_at',
        'created_at',
    )
    list_filter = ('status', 'tier')
    search_fields = ('user__email', 'chargily_subscription_id')
    list_select_related = ('user',)
    readonly_fields = [field.name for field in Subscription._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object | None = None) -> bool:
        return False

    def has_delete_permission(self, request: object, obj: object | None = None) -> bool:
        return False


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'chargily_event_id',
        'type',
        'amount_dzd',
        'status',
        'credits_granted',
        'created_at',
        'reconciled_at',
    )
    list_filter = ('type', 'status')
    search_fields = ('user__email', 'chargily_event_id')
    list_select_related = ('user',)
    readonly_fields = [field.name for field in PaymentTransaction._meta.fields]

    def has_add_permission(self, request: object) -> bool:
        return False

    def has_change_permission(self, request: object, obj: object | None = None) -> bool:
        return False

    def has_delete_permission(self, request: object, obj: object | None = None) -> bool:
        return False
