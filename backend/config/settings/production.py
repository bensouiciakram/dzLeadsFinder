import os

from .base import *  # noqa: F403

DEBUG = False

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',')

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']

SIMPLE_JWT['AUTH_COOKIE_SECURE'] = True  # noqa: F405
