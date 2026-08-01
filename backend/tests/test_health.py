import pytest
from django.contrib.auth import get_user_model
from django.test import Client

User = get_user_model()


@pytest.mark.django_db(transaction=True)
def test_health_endpoint_returns_ok():
    user = User.objects.create_user(email='health@test.com', password='testpass123')
    client = Client()
    client.post('/api/auth/login/', {'email': 'health@test.com', 'password': 'testpass123'})
    response = client.get('/api/health/')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}
