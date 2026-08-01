import os
from typing import Any, Dict, Tuple

os.environ['CELERY_TASK_ALWAYS_EAGER'] = 'True'

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

User = get_user_model()


def _fake_render_email(template: str, locale: str, context: Dict[str, Any]) -> Tuple[str, str]:
    return ('<html><body>email</body></html>', 'plain text')


@pytest.fixture(autouse=True)
def _no_network_email(monkeypatch: Any) -> None:
    monkeypatch.setattr('tasks.email_tasks.render_email', _fake_render_email)


@pytest.fixture
def api_client() -> Client:
    return Client()


@pytest.fixture
def user_data() -> Dict[str, str]:
    return {
        'email': 'test@example.com',
        'password': 'SecurePass123!',
        'locale': 'ar',
    }


@pytest.fixture
def create_user(db: Any, user_data: Dict[str, str]) -> Any:
    return User.objects.create_user(
        email=user_data['email'],
        password=user_data['password'],
        locale=user_data['locale'],
    )


@pytest.fixture
def logged_in_client(api_client: Client, create_user: Any, user_data: Dict[str, str]) -> Client:
    create_user.email_verified_at = timezone.now()
    create_user.save(update_fields=['email_verified_at'])
    api_client.post('/api/auth/login/', {
        'email': user_data['email'],
        'password': user_data['password'],
    })
    return api_client
