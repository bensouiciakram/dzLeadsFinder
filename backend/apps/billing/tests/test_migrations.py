"""Migration tests (5.4 review RP3): the 0004 receipt_sent_at backfill.

The backfill is the deploy guard against a retroactive receipt flood: without
it, the first run of resend_missing_receipts would re-enqueue a receipt for
EVERY historical succeeded payment (the new column defaults to NULL). The
MigrationExecutor pattern needs real DDL — pytest-django's per-test atomic
wrapper is disabled via transaction=True (the Django-docs testing-migrations
pattern).

NOTE: the test leaves the DB at 0004 (a rollback test would strand the test
DB at 0003 and break every later billing test in the session).
"""

from datetime import timedelta

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

pytestmark = pytest.mark.django_db(transaction=True)

MIGRATION_0004 = '0004_paymenttransaction_receipt_sent_at'


def test_0004_backfills_receipt_sent_at_for_succeeded_rows() -> None:
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate([('billing', '0003_paymenttransaction_payments_pending_created_idx')])
    now = timezone.now()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO payment_transactions
                (id, user_id, chargily_event_id, type, amount_dzd, status,
                 credits_granted, created_at, reconciled_at)
            VALUES (%s, NULL, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                '00000000-0000-0000-0000-0000000000a1',
                'evt_backfill_succeeded',
                'subscription_creation',
                1500,
                'succeeded',
                200,
                now,
                now - timedelta(minutes=5),
            ],
        )
        cursor.execute(
            """
            INSERT INTO payment_transactions
                (id, user_id, chargily_event_id, type, amount_dzd, status,
                 credits_granted, created_at, reconciled_at)
            VALUES (%s, NULL, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                '00000000-0000-0000-0000-0000000000a2',
                'evt_backfill_pending',
                'pack_purchase',
                500,
                'pending',
                None,
                now,
                None,
            ],
        )

    executor.loader.build_graph()
    executor.migrate([('billing', MIGRATION_0004)])

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT receipt_sent_at FROM payment_transactions "
            "WHERE chargily_event_id = %s",
            ['evt_backfill_succeeded'],
        )
        succeeded_marker = cursor.fetchone()[0]
        cursor.execute(
            "SELECT receipt_sent_at FROM payment_transactions "
            "WHERE chargily_event_id = %s",
            ['evt_backfill_pending'],
        )
        pending_marker = cursor.fetchone()[0]

    assert succeeded_marker is not None
    assert pending_marker is None
