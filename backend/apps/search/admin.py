from django.contrib import admin

from apps.search.models import Company, DailyUsage, Industry, Person, Wilaya


@admin.register(DailyUsage)
class DailyUsageAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'search_count', 'export_rows')
    search_fields = ('user__email',)
    list_filter = ('date',)


@admin.register(Wilaya)
class WilayaAdmin(admin.ModelAdmin):
    list_display = ('code', 'name_en', 'name_fr', 'name_ar')
    ordering = ('code',)


@admin.register(Industry)
class IndustryAdmin(admin.ModelAdmin):
    list_display = ('name_en', 'name_fr', 'name_ar', 'is_active')
    list_filter = ('is_active',)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'industry', 'wilaya_code', 'source', 'last_verified_at')
    search_fields = ('name',)


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'role', 'source', 'last_verified_at')
    search_fields = ('name',)
