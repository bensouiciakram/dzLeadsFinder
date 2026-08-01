from config.celery import app
from tasks.email_tasks import (
    check_low_credits,
    send_pack_receipt,
    send_payment_receipt,
    send_verification_email,
)


def test_email_tasks_importable() -> None:
    assert callable(send_verification_email)
    assert callable(send_payment_receipt)
    assert callable(send_pack_receipt)
    assert callable(check_low_credits)


def test_celery_beat_schedule_includes_check_low_credits() -> None:
    schedule = app.conf.beat_schedule
    assert 'check-low-credits-daily' in schedule
    entry = schedule['check-low-credits-daily']
    assert entry['task'] == 'tasks.email_tasks.check_low_credits'
    assert entry['schedule'] is not None
