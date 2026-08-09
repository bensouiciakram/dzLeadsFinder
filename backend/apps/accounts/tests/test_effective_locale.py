"""Tests for the User.effective_locale property (deferred-work 4.4 review
item — the single locale guard that replaced the duplicated `_locale()`
helpers in the credits/search/exports views)."""

from typing import Any

import pytest

pytestmark = pytest.mark.django_db


def test_canonical_locales_pass_through(create_user: Any) -> None:
    for locale in ('ar', 'fr', 'en'):
        create_user.locale = locale
        create_user.save(update_fields=['locale'])
        assert create_user.effective_locale == locale


def test_unknown_locale_falls_back_to_en(create_user: Any) -> None:
    create_user.locale = 'de'
    create_user.save(update_fields=['locale'])
    assert create_user.effective_locale == 'en'


def test_empty_locale_falls_back_to_en(create_user: Any) -> None:
    create_user.locale = ''
    create_user.save(update_fields=['locale'])
    assert create_user.effective_locale == 'en'
