"""Billing domain models: subscriptions + payment transactions (Chargily)."""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.accounts.models import TIER_CHOICES


class SubscriptionStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    FAILED_RENEWAL = 'failed_renewal', 'Failed renewal'
    CANCELLED = 'cancelled', 'Cancelled'
    EXPIRED = 'expired', 'Expired'


class PaymentStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    SUCCEEDED = 'succeeded', 'Succeeded'
    FAILED = 'failed', 'Failed'
    REFUNDED = 'refunded', 'Refunded'


class PaymentType(models.TextChoices):
    SUBSCRIPTION_CREATION = 'subscription_creation', 'Subscription creation'
    SUBSCRIPTION_RENEWAL = 'subscription_renewal', 'Subscription renewal'
    PACK_PURCHASE = 'pack_purchase', 'Pack purchase'


class Subscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscriptions',
    )
    tier = models.CharField(max_length=10, choices=TIER_CHOICES, default='starter')
    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.ACTIVE,
    )
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    chargily_subscription_id = models.TextField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'subscriptions'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=SubscriptionStatus.values),
                name='subscriptions_status_check',
            ),
            models.CheckConstraint(
                check=models.Q(tier__in=[value for value, _label in TIER_CHOICES]),
                name='subscriptions_tier_check',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.user_id} ({self.tier}, {self.status})'


class PaymentTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payment_transactions',
    )
    chargily_event_id = models.TextField(unique=True)
    type = models.CharField(max_length=30, choices=PaymentType.choices)
    amount_dzd = models.IntegerField()
    status = models.CharField(
        max_length=10,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    credits_granted = models.IntegerField(null=True, blank=True)
    chargily_checkout_url = models.TextField(null=True, blank=True)
    chargily_metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    reconciled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'payment_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['user', '-created_at'],
                name='payments_user_created_idx',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(type__in=PaymentType.values),
                name='payment_transactions_type_check',
            ),
            models.CheckConstraint(
                check=models.Q(status__in=PaymentStatus.values),
                name='payment_transactions_status_check',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.chargily_event_id} ({self.type}, {self.status})'
