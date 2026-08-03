import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('dzleads')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

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
}
