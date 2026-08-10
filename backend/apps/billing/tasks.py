"""Celery tasks for the billing app (5.2 RC-1 relocation, 2026-08-09).

The spine contradicts itself on task placement: L532 assigns "Webhook
handler + Celery tasks" to webhooks.py while L540 lists
``tasks/billing_tasks.py``. Resolved toward the repo's tasks convention:
the task lives in ``apps/billing/tasks.py`` and is registered via the
EXPLICIT ``import apps.billing.tasks`` in config/celery.py.

NOTE (5.2 D18 amended, 2026-08-09): ``app.autodiscover_tasks()`` does NOT
reliably register app tasks in this project — ``config/__init__.py`` imports
the celery app during ``django.setup()`` (before the app registry is ready),
so autodiscovery no-ops. That is exactly why ``tasks/email_tasks.py`` and
``tasks/maintenance_tasks.py`` are explicitly imported. The explicit import
is mandatory; do not remove it (tested by
``test_config_celery_explicitly_imports_billing_tasks``).

Module-level imports are limited to stdlib + ``celery`` — the module is
imported by Celery before the app registry is ready (the
``tasks/email_tasks.py`` precedent, 5.2 D9). All Django model/settings reads
are deferred to runtime.

Task full name pinned as a contract: ``apps.billing.tasks.grant_credits``
(5.3 owns the real grant logic).
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(  # type: ignore[misc]
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True,
)
def grant_credits(event_id: str) -> None:
    """Reconcile a paid Chargily event — bridge in 5.2 (5.2 D7/D15).

    The real grant logic (credit_ledger insert, subscription create/renew,
    receipt email) lands in 5.3. The bridge re-queries the transaction row,
    so the task is idempotent and safe on missing rows. Retry policy per
    AD-14: 3 retries with exponential backoff (payment reconciliation).
    """
    from apps.billing.models import PaymentTransaction

    try:
        row = PaymentTransaction.objects.get(chargily_event_id=event_id)
    except PaymentTransaction.DoesNotExist:
        logger.warning('grant_credits: no transaction row for event_id=%s', event_id)
        return
    if row.user_id is None:
        logger.warning(
            'grant_credits: transaction %s has no user (anonymised) — grant skipped',
            event_id,
        )
        return
    logger.info(
        'grant_credits: event_id=%s recorded (type=%s) — grant logic lands in 5.3',
        event_id,
        row.type,
    )
