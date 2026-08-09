"""Test settings running the full pytest suite against PostgreSQL (CI job).

Inherits the SQLite test settings (in-memory) but swaps the database for a
PostgreSQL 16 service container provided by GitHub Actions. This is the
epic-4 retro action item #4 deliverable: `select_for_update`, ON CONFLICT
DO NOTHING and the SERIALIZABLE guards are exercised on real PG, not just
asserted on SQLite.
"""

import os

from .test import *  # noqa: F401, F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'dzleads_test'),
        'USER': os.environ.get('POSTGRES_USER', 'postgres'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
        'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
    }
}
