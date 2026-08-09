"""Idempotency guard tests: chargily_event_id UNIQUE is the webhook double-grant barrier (AD-5)."""


from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from apps.billing.models import PaymentTransaction, Subscription

User = get_user_model()

pytestmark = pytest.mark.django_db


def _txn(user: object, event_id: str, **extra: object) -> Any:
    kwargs = {
        'user': user,
        'chargily_event_id': event_id,
        'type': 'subscription_creation',
        'amount_dzd': 1500,
        **extra,
    }
    return PaymentTransaction.objects.create(**kwargs)


class TestDuplicateEventRejected:
    def test_duplicate_create_raises_integrity_error(self) -> None:
        user = User.objects.create_user(email='dup@example.com', password='SecurePass123!')
        _txn(user, 'evt-webhook-1')
        with pytest.raises(IntegrityError):
            _txn(user, 'evt-webhook-1')

    def test_duplicate_rejected_even_for_another_user(self) -> None:
        user_a = User.objects.create_user(email='dupa@example.com', password='SecurePass123!')
        user_b = User.objects.create_user(email='dupb@example.com', password='SecurePass123!')
        _txn(user_a, 'evt-webhook-2')
        with pytest.raises(IntegrityError):
            _txn(user_b, 'evt-webhook-2')

    def test_same_user_two_distinct_events_both_persist(self) -> None:
        user = User.objects.create_user(email='two@example.com', password='SecurePass123!')
        _txn(user, 'evt-webhook-3')
        _txn(user, 'evt-webhook-4')
        assert PaymentTransaction.objects.count() == 2


class TestOnConflictDoNothing:
    def test_duplicate_batch_inserts_exactly_one_row(self) -> None:
        user = User.objects.create_user(email='conflict@example.com', password='SecurePass123!')
        PaymentTransaction.objects.bulk_create(
            [
                PaymentTransaction(
                    user=user,
                    chargily_event_id='evt-webhook-5',
                    type='subscription_creation',
                    amount_dzd=1500,
                ),
                PaymentTransaction(
                    user=user,
                    chargily_event_id='evt-webhook-5',
                    type='subscription_creation',
                    amount_dzd=1500,
                ),
            ],
            ignore_conflicts=True,
        )
        assert PaymentTransaction.objects.count() == 1

    def test_duplicate_insert_after_existing_row_is_noop(self) -> None:
        user = User.objects.create_user(email='noop@example.com', password='SecurePass123!')
        _txn(user, 'evt-webhook-6')
        PaymentTransaction.objects.bulk_create(
            [
                PaymentTransaction(
                    user=user,
                    chargily_event_id='evt-webhook-6',
                    type='subscription_renewal',
                    amount_dzd=1500,
                ),
            ],
            ignore_conflicts=True,
        )
        assert PaymentTransaction.objects.count() == 1
        remaining = PaymentTransaction.objects.get(chargily_event_id='evt-webhook-6')
        assert remaining.type == 'subscription_creation'
        assert remaining.status == 'pending'

    def test_duplicate_cannot_double_grant_credits(self) -> None:
        user = User.objects.create_user(email='grant@example.com', password='SecurePass123!')
        first = _txn(user, 'evt-webhook-7', type='subscription_creation', credits_granted=200)
        PaymentTransaction.objects.bulk_create(
            [
                PaymentTransaction(
                    user=user,
                    chargily_event_id='evt-webhook-7',
                    type='subscription_creation',
                    amount_dzd=1500,
                    credits_granted=200,
                ),
            ],
            ignore_conflicts=True,
        )
        granted_rows = PaymentTransaction.objects.filter(credits_granted__isnull=False)
        assert granted_rows.count() == 1
        assert granted_rows.get().pk == first.pk

    def test_conflict_path_surfaces_through_pinned_count(self) -> None:
        user = User.objects.create_user(email='pin@example.com', password='SecurePass123!')
        PaymentTransaction.objects.bulk_create(
            [
                PaymentTransaction(
                    user=user,
                    chargily_event_id='evt-webhook-8',
                    type='pack_purchase',
                    amount_dzd=500,
                ),
                PaymentTransaction(
                    user=user,
                    chargily_event_id='evt-webhook-8',
                    type='pack_purchase',
                    amount_dzd=500,
                ),
            ],
            ignore_conflicts=True,
        )
        assert PaymentTransaction.objects.count() == 1


class TestForeignKeyBehavior:
    def test_user_delete_cascades_subscription_and_transactions(self) -> None:
        user = User.objects.create_user(email='cascade@example.com', password='SecurePass123!')
        _txn(user, 'evt-webhook-9')
        Subscription.objects.create(
            user=user,
            current_period_start='2026-08-01T00:00:00Z',
            current_period_end='2026-09-01T00:00:00Z',
        )
        assert PaymentTransaction.objects.count() == 1
        assert Subscription.objects.count() == 1
        user.delete()
        assert PaymentTransaction.objects.count() == 0
        assert Subscription.objects.count() == 0
