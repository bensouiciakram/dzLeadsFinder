import os

from .base import *  # noqa: F403

DEBUG = True

ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'dzleads'),
        'USER': os.environ.get('POSTGRES_USER', 'dzleads'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'dzleads_dev_password'),
        'HOST': os.environ.get('POSTGRES_HOST', 'postgres'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
    }
}
