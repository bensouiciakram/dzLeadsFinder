from pathlib import Path
from typing import Any

import pytest

import config.celery
from apps.billing.models import PaymentTransaction
from apps.billing.webhooks import grant_credits
from apps.credits.models import CreditLedger

pytestmark = pytest.mark.django_db

TASK_FULL_NAME = 'apps.billing.webhooks.grant_credits'


def test_task_name_is_pinned_contract() -> None:
    assert grant_credits.name == TASK_FULL_NAME


def test_task_is_callable() -> None:
    assert callable(grant_credits)


def test_task_registered_in_celery_registry() -> None:
    registered = config.celery.app.tasks.get(TASK_FULL_NAME)
    assert registered is not None
    assert registered.name == TASK_FULL_NAME
    assert grant_credits.name == TASK_FULL_NAME


def test_task_retry_policy_matches_ad14() -> None:
    assert grant_credits.max_retries == 3
    assert grant_credits.autoretry_for == (Exception,)


def test_config_celery_explicitly_imports_webhooks_task_module() -> None:
    """Explicit import is MANDATORY — autodiscover_tasks scans only <app>.tasks
    (5.2 D18); a rename/removal breaks worker task registration loudly.
    """
    source = Path(config.celery.__file__).read_text(encoding='utf-8')
    assert 'import apps.billing.webhooks' in source


def test_missing_row_is_safe() -> None:
    grant_credits('no-such-event')
    assert PaymentTransaction.objects.count() == 0
    assert CreditLedger.objects.count() == 0


def test_existing_row_logs_without_side_effects(
    create_user: Any, caplog: Any
) -> None:
    row = PaymentTransaction.objects.create(
        user=create_user,
        chargily_event_id='evt_bridge_1',
        type='pack_purchase',
        amount_dzd=500,
    )
    with caplog.at_level('INFO'):
        grant_credits('evt_bridge_1')
    row.refresh_from_db()
    assert row.status == 'pending'
    assert row.credits_granted is None
    assert CreditLedger.objects.count() == 0
    assert 'evt_bridge_1' in caplog.text


def test_anonymised_row_is_safe() -> None:
    PaymentTransaction.objects.create(
        user=None,
        chargily_event_id='evt_ghost',
        type='subscription_creation',
        amount_dzd=1500,
    )
    grant_credits('evt_ghost')
    assert PaymentTransaction.objects.count() == 1
    assert CreditLedger.objects.count() == 0
