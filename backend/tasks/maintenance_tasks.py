import logging
from datetime import timedelta
from typing import Any, List, Tuple

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

LEDGER_RETENTION_DAYS: int = 90

DEPENDENT_MODELS: List[Tuple[str, str]] = [
    ('credits', 'Reveal'),
    ('exports', 'Export'),
    ('search', 'Search'),
    ('search', 'SavedSearch'),
]

# Financial rows are anonymised (user_id -> NULL) instead of deleted so the
# DZD amounts / provider ids needed for refunds, disputes and revenue
# reconciliation survive account deletion (the 5.1 review decision).
ANONYMISED_MODELS: List[Tuple[str, str]] = [
    ('credits', 'CreditLedger'),
    ('billing', 'Subscription'),
    ('billing', 'PaymentTransaction'),
]


@shared_task  # type: ignore[misc]
def hard_delete_expired() -> None:
    """Hard-delete accounts whose 7-day deletion grace period has expired.

    Django imports are deferred to runtime: config/celery.py imports this
    module before the app registry is ready.
    """
    from django.apps import apps
    from django.contrib.auth import get_user_model
    from django.db import transaction

    user_model = get_user_model()
    now = timezone.now()
    expired = user_model.objects.filter(
        deleted_at__isnull=False,
        deletion_scheduled_at__isnull=False,
        deletion_scheduled_at__lte=now,
    )
    for user in expired.iterator():
        try:
            with transaction.atomic():
                _anonymise_financial_rows(user.pk, apps)
                _delete_dependent_rows(user.pk, apps)
                user.delete()
        except Exception:
            logger.exception(
                'hard_delete_expired: failed to hard-delete user %s', user.pk,
            )
            continue
    _purge_anonymised_rows(apps, now)


def _delete_dependent_rows(user_id: Any, apps: Any) -> None:
    for app_label, model_name in DEPENDENT_MODELS:
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            continue
        if model is None:
            continue
        model.objects.filter(user_id=user_id).delete()


def _anonymise_financial_rows(user_id: Any, apps: Any) -> None:
    for app_label, model_name in ANONYMISED_MODELS:
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            continue
        if model is None:
            continue
        model.objects.filter(user_id=user_id).update(user_id=None)


def _purge_anonymised_rows(apps: Any, now: Any) -> None:
    purge_before = now - timedelta(days=LEDGER_RETENTION_DAYS)
    for app_label, model_name in ANONYMISED_MODELS:
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            continue
        if model is None:
            continue
        model.objects.filter(user_id__isnull=True, created_at__lt=purge_before).delete()
