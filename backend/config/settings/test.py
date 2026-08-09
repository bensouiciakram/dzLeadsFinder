from .development import *  # noqa: F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

CHARGILY_API_KEY = 'test-api-key'
CHARGILY_WEBHOOK_SECRET = 'test-webhook-secret'
CHARGILY_MODE = 'test'
CHARGILY_SUCCESS_URL = 'http://localhost:3000/billing?status=success'
CHARGILY_FAILURE_URL = 'http://localhost:3000/billing?status=failure'

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_RESULT_BACKEND = 'cache+memory://'
