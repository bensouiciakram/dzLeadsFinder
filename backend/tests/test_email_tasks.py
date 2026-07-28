from tasks.email_tasks import (
    render_email,
    send_verification_email,
    send_payment_receipt,
    send_pack_receipt,
    check_low_credits,
)
from config.celery import app


def test_email_tasks_importable():
    assert callable(send_verification_email)
    assert callable(send_payment_receipt)
    assert callable(send_pack_receipt)
    assert callable(check_low_credits)


def test_celery_beat_schedule_includes_check_low_credits():
    schedule = app.conf.beat_schedule
    assert 'check-low-credits-daily' in schedule
    entry = schedule['check-low-credits-daily']
    assert entry['task'] == 'tasks.email_tasks.check_low_credits'
    assert entry['schedule'] is not None
