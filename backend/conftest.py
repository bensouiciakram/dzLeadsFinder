import os
from typing import Any, Dict

os.environ['CELERY_TASK_ALWAYS_EAGER'] = 'True'

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

User = get_user_model()


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
    api_client.post('/api/auth/login/', {
        'email': user_data['email'],
        'password': user_data['password'],
    })
    return api_client
