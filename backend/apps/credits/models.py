"""Credit metering models: the audit ledger and the reveals table."""

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class CreditEventType(models.TextChoices):
    FREE_SIGNUP = 'free_signup', 'Free signup'
    SUBSCRIPTION_GRANT = 'subscription_grant', 'Subscription grant'
    PACK_GRANT = 'pack_grant', 'Pack grant'
    PROMOTIONAL_GRANT = 'promotional_grant', 'Promotional grant'
    REVEAL_DEBIT = 'reveal_debit', 'Reveal debit'
    EXPORT_ROW_DEBIT = 'export_row_debit', 'Export row debit'
    EXPIRY = 'expiry', 'Expiry'


class CreditPool(models.TextChoices):
    SUBSCRIPTION = 'subscription', 'Subscription'
    PACK = 'pack', 'Pack'


# The record-type vocabulary as plain str constants — the single source the
# services/views layer compares against (mypy-strict without casts); the
# TextChoices enum derives FROM them so the DB-facing choices can never
# drift from the constants.
RECORD_TYPE_PEOPLE: str = 'people'
RECORD_TYPE_COMPANY: str = 'company'


class RevealRecordType(models.TextChoices):
    PEOPLE = RECORD_TYPE_PEOPLE, 'People'
    COMPANY = RECORD_TYPE_COMPANY, 'Company'


class CreditLedger(models.Model):
    """Append-only source of truth for a user's credit balance.

    `users.credits_balance` is only a cache; the ledger is queried directly
    on any audit or reconciliation (AD-4). The user FK is nullable with
    SET_NULL so account deletion can anonymise rows (2.6 contract) before
    the 90-day retention purge.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='credit_ledger',
    )
    event_type = models.CharField(max_length=24, choices=CreditEventType.choices)
    amount = models.IntegerField()
    balance_after = models.IntegerField()
    pool = models.CharField(
        max_length=14,
        choices=CreditPool.choices,
        default=CreditPool.SUBSCRIPTION,
    )
    reference_id = models.TextField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'credit_ledger'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at'], name='credit_ledger_user_created_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(event_type__in=CreditEventType.values),
                name='credit_ledger_event_type_check',
            ),
            models.CheckConstraint(
                check=Q(pool__in=CreditPool.values),
                name='credit_ledger_pool_check',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.event_type} {self.amount:+d} -> {self.balance_after} (user {self.user_id})'


class Reveal(models.Model):
    """A contact-data unlock. Paid reveals cost 1 credit; re-reveals within
    30 days are free (was_free=True). The partial unique index blocks
    duplicate PAID reveals while allowing free re-reveal rows."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reveals',
    )
    record_type = models.CharField(max_length=10, choices=RevealRecordType.choices)
    record_id = models.TextField()
    credit_cost = models.IntegerField(default=1)
    was_free = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'reveals'
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['user', 'record_type', 'created_at'],
                name='reveals_user_type_created_idx',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(record_type__in=RevealRecordType.values),
                name='reveals_record_type_check',
            ),
            models.UniqueConstraint(
                fields=['user', 'record_type', 'record_id'],
                condition=Q(was_free=False),
                name='reveals_user_record_paid_unique',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.record_type}:{self.record_id} (free={self.was_free})'
