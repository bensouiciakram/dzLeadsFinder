import pytest
from django.test import Client


@pytest.mark.django_db(transaction=True)
def test_health_endpoint_returns_ok():
    client = Client()
    response = client.get('/api/health/')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}
