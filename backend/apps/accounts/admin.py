from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'email',
        'locale',
        'tier',
        'credits_balance',
        'is_staff',
        'last_active_at',
        'checklist_dismissed_at',
    )
    list_filter = ('tier', 'locale', 'is_staff', 'is_active')
    search_fields = ('email',)
    ordering = ('-date_joined',)
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        # credits_balance is a cache of the ledger (AD-4) — staff edits would
        # desynchronize it with no ledger row; corrections go through the
        # append-only ledger admin (4.1).
        ('Profile', {'fields': ('locale', 'tier', 'email_verified_at')}),
        ('Activity', {'fields': ('last_active_at', 'token_version')}),
        ('Account State', {
            'fields': (
                'deleted_at',
                'deletion_scheduled_at',
                'checklist_dismissed_at',
                'is_active',
                'is_staff',
                'is_superuser',
            ),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    readonly_fields = (
        'last_active_at',
        'token_version',
        'date_joined',
        'checklist_dismissed_at',
        'credits_balance',
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
    )
