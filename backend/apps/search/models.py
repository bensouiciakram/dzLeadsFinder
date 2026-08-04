import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.search import search_index


class Wilaya(models.Model):
    code = models.SmallIntegerField(primary_key=True)
    name_ar = models.CharField(max_length=64)
    name_fr = models.CharField(max_length=64)
    name_en = models.CharField(max_length=64)

    class Meta:
        db_table = 'wilayas'
        ordering = ['code']
        constraints = [
            models.CheckConstraint(
                check=models.Q(code__gte=1, code__lte=58),
                name='wilayas_code_range',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.code} — {self.name_en}'


class Industry(models.Model):
    id = models.AutoField(primary_key=True)
    name_ar = models.CharField(max_length=64)
    name_fr = models.CharField(max_length=64)
    name_en = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'industries'
        ordering = ['name_en']

    def __str__(self) -> str:
        return str(self.name_en)


class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    industry = models.ForeignKey(
        Industry,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='companies',
        db_column='industry_id',
    )
    wilaya_code = models.ForeignKey(
        Wilaya,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='companies',
        db_column='wilaya_code',
    )
    size_band = models.TextField(null=True, blank=True)
    website = models.TextField(null=True, blank=True)
    source = models.TextField()
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    search_normalized = models.TextField(default='', blank=True)

    class Meta:
        db_table = 'companies'

    def save(self, *args: object, **kwargs: object) -> None:
        self.search_normalized = search_index.normalize_search(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return str(self.name)


class Person(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        Company,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='people',
        db_column='company_id',
    )
    name = models.TextField()
    role = models.TextField(null=True, blank=True)
    seniority = models.TextField(null=True, blank=True)
    email = models.TextField(null=True, blank=True)
    phone = models.TextField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    source = models.TextField()
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    search_normalized = models.TextField(default='', blank=True)

    class Meta:
        db_table = 'people'

    def save(self, *args: object, **kwargs: object) -> None:
        self.search_normalized = search_index.normalize_search(self.name, self.role or '')
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return str(self.name)


class DailyUsage(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_usage',
    )
    date = models.DateField(default=timezone.localdate)
    search_count = models.IntegerField(default=0)
    export_rows = models.IntegerField(default=0)

    class Meta:
        db_table = 'daily_usage'
        constraints = [
            models.UniqueConstraint(fields=['user', 'date'], name='daily_usage_user_date_unique'),
        ]

    def __str__(self) -> str:
        return f'{self.user_id} @ {self.date}'
