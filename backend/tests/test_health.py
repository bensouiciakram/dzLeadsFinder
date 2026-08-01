import pytest
from django.test import Client


def test_health_live_is_public(api_client: Client) -> None:
    response = api_client.get('/api/health/live/')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


@pytest.mark.django_db
def test_health_requires_auth(api_client: Client) -> None:
    response = api_client.get('/api/health/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_health_endpoint_returns_ok(logged_in_client: Client) -> None:
    response = logged_in_client.get('/api/health/')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}
