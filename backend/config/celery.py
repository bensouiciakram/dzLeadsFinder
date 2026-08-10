import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('dzleads')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

import apps.billing.tasks  # noqa: E402,F401 — explicit import so Celery registers tasks (5.2 D18 amended: autodiscover_tasks() no-ops pre-django.setup — config/__init__ imports celery during setup; the email_tasks/maintenance_tasks precedent)
import tasks.email_tasks  # noqa: E402,F401 — explicit import so Celery registers tasks
import tasks.maintenance_tasks  # noqa: E402,F401 — explicit import so Celery registers tasks

app.conf.beat_schedule = {
    'check-low-credits-daily': {
        'task': 'tasks.email_tasks.check_low_credits',
        'schedule': crontab(hour=8, minute=0),
    },
    'hard-delete-expired-daily': {
        'task': 'tasks.maintenance_tasks.hard_delete_expired',
        'schedule': crontab(hour=3, minute=0),
    },
    'reconcile-pending-payments-hourly': {
        'task': 'apps.billing.tasks.reconcile_pending_payments',
        'schedule': crontab(minute=0),
    },
    'resend-missing-receipts-hourly': {
        'task': 'apps.billing.tasks.resend_missing_receipts',
        'schedule': crontab(minute=10),
    },
    'expire-failed-renewals-daily': {
        'task': 'apps.billing.tasks.expire_failed_renewals',
        'schedule': crontab(hour=4, minute=0),
    },
}
