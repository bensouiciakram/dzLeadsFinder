import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.fixture
def api_client():
    return Client()


@pytest.fixture
def user_data():
    return {
        'email': 'test@example.com',
        'password': 'SecurePass123!',
        'locale': 'ar',
    }


@pytest.fixture
def create_user(db, user_data):
    user = User.objects.create_user(
        email=user_data['email'],
        password=user_data['password'],
        locale=user_data['locale'],
    )
    return user


@pytest.mark.django_db
class TestUserModel:

    def test_user_creates_with_defaults(self):
        user = User.objects.create_user(
            email='defaults@example.com',
            password='password123',
        )
        assert user.locale == 'ar'
        assert user.tier == 'free'
        assert user.credits_balance == 0
        assert user.token_version == 0
        assert user.email_verified_at is None
        assert user.deleted_at is None
        assert user.deletion_scheduled_at is None
        assert user.last_active_at is not None

    def test_user_email_is_unique(self, user_data):
        User.objects.create_user(
            email=user_data['email'],
            password=user_data['password'],
        )
        with pytest.raises(Exception):
            User.objects.create_user(
                email=user_data['email'],
                password='otherpass123',
            )

    def test_user_str_returns_email(self, create_user):
        assert str(create_user) == create_user.email

    def test_user_email_is_username_field(self):
        assert User.USERNAME_FIELD == 'email'

    def test_user_requires_email(self):
        with pytest.raises(ValueError):
            User.objects.create_user(email='', password='password123')

    def test_user_custom_fields_are_accessible(self, create_user):
        create_user.locale = 'fr'
        create_user.tier = 'starter'
        create_user.credits_balance = 15
        create_user.token_version = 3
        create_user.save()
        user = User.objects.get(pk=create_user.pk)
        assert user.locale == 'fr'
        assert user.tier == 'starter'
        assert user.credits_balance == 15
        assert user.token_version == 3

    def test_user_superuser_creation(self):
        admin = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123',
        )
        assert admin.is_staff is True
        assert admin.is_superuser is True

    def test_user_created_at_is_auto(self, create_user):
        assert create_user.created_at is not None

    def test_user_last_active_at_updates_on_save(self, create_user):
        from django.utils import timezone
        old = create_user.last_active_at
        create_user.last_active_at = timezone.now()
        create_user.save()
        updated = User.objects.get(pk=create_user.pk)
        assert updated.last_active_at > old


@pytest.mark.django_db
class TestAuthEndpoints:

    def test_login_returns_200_and_sets_cookie(self, api_client, create_user, user_data):
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'access_token' in response.cookies
        cookie = response.cookies['access_token']
        assert cookie['httponly'] is True
        assert cookie['samesite'] == 'Lax'

    def test_login_wrong_password_returns_400(self, api_client, create_user, user_data):
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': 'wrongpassword',
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_wrong_email_returns_400(self, api_client):
        response = api_client.post('/api/auth/login/', {
            'email': 'nonexistent@example.com',
            'password': 'somepassword',
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_missing_fields_returns_400(self, api_client):
        response = api_client.post('/api/auth/login/', {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_logout_clears_cookie(self, api_client, create_user, user_data):
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.post('/api/auth/logout/')
        assert response.status_code == status.HTTP_200_OK
        if 'access_token' in response.cookies:
            cookie = response.cookies['access_token']
            assert cookie.value == '' or cookie.value is None

    def test_unauthenticated_request_returns_401(self, api_client):
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_request_succeeds(self, api_client, create_user, user_data):
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_jwt_payload_contains_token_version(self, api_client, create_user, user_data):
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTokenVersionInvalidation:

    def test_password_change_increments_token_version(self, api_client, create_user, user_data):
        old_version = create_user.token_version
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        api_client.post('/api/auth/logout/')
        create_user.set_password('NewSecurePass456!')
        create_user.save()
        updated_user = User.objects.get(pk=create_user.pk)
        assert updated_user.token_version == old_version + 1

    def test_old_jwt_invalidated_after_password_change(self, api_client, create_user, user_data):
        login_resp = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login_resp.status_code == status.HTTP_200_OK
        create_user.set_password('NewSecurePass456!')
        create_user.save()
        bad_resp = api_client.get('/api/health/')
        assert bad_resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_user_can_login_with_new_password(self, api_client, create_user, user_data):
        create_user.set_password('NewSecurePass456!')
        create_user.save()
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': 'NewSecurePass456!',
        })
        assert response.status_code == status.HTTP_200_OK
        good_resp = api_client.get('/api/health/')
        assert good_resp.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestInactivityCheck:

    def test_inactive_user_returns_401(self, api_client, create_user, user_data):
        from django.utils import timezone
        from datetime import timedelta
        create_user.last_active_at = timezone.now() - timedelta(days=31)
        create_user.save()
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_active_user_within_30_days_succeeds(self, api_client, create_user, user_data):
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_recently_active_user_succeeds(self, api_client, create_user, user_data):
        from django.utils import timezone
        from datetime import timedelta
        create_user.last_active_at = timezone.now() - timedelta(days=1)
        create_user.save()
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_edge_case_29_days_succeeds(self, api_client, create_user, user_data):
        from django.utils import timezone
        from datetime import timedelta
        create_user.last_active_at = timezone.now() - timedelta(days=29)
        create_user.save()
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_edge_case_29_days_23h_succeeds(self, api_client, create_user, user_data):
        from django.utils import timezone
        from datetime import timedelta
        create_user.last_active_at = timezone.now() - timedelta(days=29, hours=23)
        create_user.save()
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_inactive_30_days_1s_returns_401(self, api_client, create_user, user_data):
        from django.utils import timezone
        from datetime import timedelta
        create_user.last_active_at = timezone.now() - timedelta(days=30, seconds=1)
        create_user.save()
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestDjangoAdmin:

    def test_staff_user_can_access_admin(self, api_client):
        staff = User.objects.create_superuser(
            email='staff@example.com',
            password='staffpass123',
        )
        api_client.force_login(staff)
        response = api_client.get('/admin/')
        assert response.status_code == status.HTTP_200_OK

    def test_non_staff_user_redirected_from_admin(self, api_client, create_user):
        api_client.force_login(create_user)
        response = api_client.get('/admin/')
        assert response.status_code in (status.HTTP_302_FOUND, status.HTTP_403_FORBIDDEN)

    def test_admin_user_list_shows_user_model(self, api_client, create_user):
        staff = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123',
        )
        api_client.force_login(staff)
        response = api_client.get('/admin/accounts/user/')
        assert response.status_code == status.HTTP_200_OK

    def test_unauthenticated_user_redirected_from_admin(self, api_client):
        response = api_client.get('/admin/')
        assert response.status_code == status.HTTP_302_FOUND
