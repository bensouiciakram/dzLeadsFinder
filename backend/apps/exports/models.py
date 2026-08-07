"""The exports table: one row per charged export job (FR-17/18/20).

Spine DDL (ARCHITECTURE-SPINE.md#L225-235) plus the 4.4 extensions:
`rows_json` holds the frozen row snapshot (deterministic regeneration on
download — the user paid for THAT file, never live-DB drift) and `locale`
freezes the header language at POST time (FR-3). `watermark` stays False
until 4.6 fills it (free-tier watermarked CSV).
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class ExportFormat(models.TextChoices):
    CSV = 'csv', 'CSV'
    XLSX = 'xlsx', 'XLSX'


class Export(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='exports',
    )
    format = models.CharField(max_length=4, choices=ExportFormat.choices)
    row_count = models.IntegerField()
    credits_cost = models.IntegerField()
    included_unrevealed = models.BooleanField(default=True)
    watermark = models.BooleanField(default=False)
    rows_json = models.JSONField(default=dict)
    locale = models.CharField(max_length=2)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'exports'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                check=models.Q(format__in=['csv', 'xlsx']),
                name='exports_format_check',
            ),
            models.CheckConstraint(
                check=models.Q(row_count__gte=0),
                name='exports_row_count_non_negative',
            ),
            models.CheckConstraint(
                check=models.Q(credits_cost__gte=0),
                name='exports_credits_cost_non_negative',
            ),
        ]
        indexes = [
            models.Index(
                fields=['user', 'created_at'],
                name='exports_user_created_idx',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.user_id} @ {self.format} ({self.row_count} rows)'
