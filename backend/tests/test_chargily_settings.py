import importlib
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings


def _import_production(monkeypatch: Any) -> Any:
    import config.settings.production as production

    return importlib.reload(production)


class TestChargilySettings:
    def test_test_settings_pin_test_values(self) -> None:
        assert settings.CHARGILY_API_KEY == 'test-api-key'
        assert settings.CHARGILY_WEBHOOK_SECRET == 'test-webhook-secret'
        assert settings.CHARGILY_MODE == 'test'
        assert settings.CHARGILY_SUCCESS_URL == (
            'http://localhost:3000/billing?status=success'
        )
        assert settings.CHARGILY_FAILURE_URL == (
            'http://localhost:3000/billing?status=failure'
        )

    def test_production_requires_the_two_secrets(self, monkeypatch: Any) -> None:
        monkeypatch.setenv('DJANGO_SECRET_KEY', 'prod-secret')
        monkeypatch.setenv('FRONTEND_PUBLIC_URL', 'https://app.example.com')
        monkeypatch.setenv('EMAIL_HOST', 'smtp.example.com')
        monkeypatch.delenv('CHARGILY_API_KEY', raising=False)
        monkeypatch.delenv('CHARGILY_WEBHOOK_SECRET', raising=False)
        with pytest.raises(KeyError):
            _import_production(monkeypatch)

    def test_production_resolves_env_values(self, monkeypatch: Any) -> None:
        monkeypatch.setenv('DJANGO_SECRET_KEY', 'prod-secret')
        monkeypatch.setenv('FRONTEND_PUBLIC_URL', 'https://app.example.com')
        monkeypatch.setenv('EMAIL_HOST', 'smtp.example.com')
        monkeypatch.setenv('CHARGILY_API_KEY', 'prod-api-key')
        monkeypatch.setenv('CHARGILY_WEBHOOK_SECRET', 'prod-webhook-secret')
        production = _import_production(monkeypatch)
        assert production.CHARGILY_API_KEY == 'prod-api-key'
        assert production.CHARGILY_WEBHOOK_SECRET == 'prod-webhook-secret'
        assert production.CHARGILY_MODE == 'live'


class TestSecretHygiene:
    def test_no_chargily_secrets_in_the_client_bundle(self) -> None:
        repo_root = Path(__file__).resolve().parent.parent.parent
        frontend_root = repo_root / 'frontend'
        for subdir in ('src', 'messages', 'public'):
            scan_root = frontend_root / subdir
            if not scan_root.is_dir():
                continue
            for path in scan_root.rglob('*'):
                if not path.is_file() or path.suffix not in {'.ts', '.tsx', '.js', '.jsx', '.json'}:
                    continue
                text = path.read_text(encoding='utf-8', errors='ignore')
                assert 'CHARGILY_API_KEY' not in text, path
                assert 'CHARGILY_WEBHOOK_SECRET' not in text, path

    def test_chargily_modules_never_log_secrets(self) -> None:
        billing_root = Path(__file__).resolve().parent.parent / 'apps' / 'billing'
        for name in ('chargily.py', 'webhooks.py'):
            text = (billing_root / name).read_text(encoding='utf-8')
            for line in text.splitlines():
                if 'logger.' in line or 'logging.' in line:
                    assert 'CHARGILY_API_KEY' not in line, f'{name}: {line}'
                    assert 'CHARGILY_WEBHOOK_SECRET' not in line, f'{name}: {line}'
