import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('dzleads')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

import tasks.email_tasks  # noqa: F401 — explicit import so Celery registers tasks

app.conf.beat_schedule = {
    'check-low-credits-daily': {
        'task': 'tasks.email_tasks.check_low_credits',
        'schedule': crontab(hour=8, minute=0),
    },
}
