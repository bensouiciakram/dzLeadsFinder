import os

from .base import *  # noqa: F403

DEBUG = False

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',')

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']

CHARGILY_API_KEY = os.environ['CHARGILY_API_KEY']
CHARGILY_WEBHOOK_SECRET = os.environ['CHARGILY_WEBHOOK_SECRET']
CHARGILY_MODE = os.environ.get('CHARGILY_MODE', 'live')

SIMPLE_JWT['AUTH_COOKIE_SECURE'] = True  # noqa: F405

# The host Caddy reverse-proxy terminates TLS — Django must trust its
# X-Forwarded-Proto or admin redirects and cookie security break behind it.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

FRONTEND_PUBLIC_URL = os.environ['FRONTEND_PUBLIC_URL']

EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend'
)
if EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend':
    EMAIL_HOST = os.environ['EMAIL_HOST']
