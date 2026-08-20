from typing import Any, Dict

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


def _verify_user(user: Any) -> None:
    user.email_verified_at = timezone.now()
    user.save(update_fields=['email_verified_at'])


@pytest.mark.django_db
class TestUserModel:

    def test_user_creates_with_defaults(self) -> None:
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

    def test_user_email_is_unique(self, user_data: Dict[str, str]) -> None:
        User.objects.create_user(
            email=user_data['email'],
            password=user_data['password'],
        )
        with pytest.raises(Exception):
            User.objects.create_user(
                email=user_data['email'],
                password='otherpass123',
            )

    def test_user_email_is_lowercased(self, user_data: Dict[str, str]) -> None:
        user = User.objects.create_user(
            email='MiXeD@Example.COM',
            password=user_data['password'],
        )
        assert user.email == 'mixed@example.com'

    def test_user_str_returns_email(self, create_user: Any) -> None:
        assert str(create_user) == create_user.email

    def test_user_email_is_username_field(self) -> None:
        assert User.USERNAME_FIELD == 'email'

    def test_user_requires_email(self) -> None:
        with pytest.raises(ValueError):
            User.objects.create_user(email='', password='password123')

    def test_user_custom_fields_are_accessible(self, create_user: Any) -> None:
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

    def test_user_superuser_creation(self) -> None:
        admin = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123',
        )
        assert admin.is_staff is True
        assert admin.is_superuser is True

    def test_user_created_at_is_auto(self, create_user: Any) -> None:
        assert create_user.created_at is not None

    def test_user_last_active_at_updates_on_save(self, create_user: Any) -> None:
        from django.utils import timezone
        old = create_user.last_active_at
        create_user.last_active_at = timezone.now()
        create_user.save()
        updated = User.objects.get(pk=create_user.pk)
        assert updated.last_active_at > old


@pytest.mark.django_db
class TestAuthEndpoints:

    def test_login_returns_200_and_sets_cookies(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert response.status_code == status.HTTP_200_OK
        for name in ('access_token', 'refresh_token'):
            assert name in response.cookies
            cookie = response.cookies[name]
            assert cookie['httponly'] is True
            assert cookie['samesite'] == 'Lax'

    def test_login_with_uppercase_email_succeeds(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'].upper(),
            'password': user_data['password'],
        })
        assert response.status_code == status.HTTP_200_OK

    def test_login_wrong_password_returns_400(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': 'wrongpassword',
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_wrong_email_returns_400(self, api_client: Client) -> None:
        response = api_client.post('/api/auth/login/', {
            'email': 'nonexistent@example.com',
            'password': 'somepassword',
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_missing_fields_returns_400(self, api_client: Client) -> None:
        response = api_client.post('/api/auth/login/', {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_updates_last_login_and_last_active(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert response.status_code == status.HTTP_200_OK
        user = User.objects.get(pk=create_user.pk)
        assert user.last_login is not None
        assert user.last_active_at is not None

    def test_logout_clears_cookies(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        response = api_client.post('/api/auth/logout/')
        assert response.status_code == status.HTTP_200_OK
        for name in ('access_token', 'refresh_token'):
            if name in response.cookies:
                assert response.cookies[name].value == ''

    def test_logout_with_stale_cookie_still_clears(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        create_user.set_password('NewSecurePass456!')
        create_user.save()
        response = api_client.post('/api/auth/logout/')
        assert response.status_code == status.HTTP_200_OK
        for name in ('access_token', 'refresh_token'):
            if name in response.cookies:
                assert response.cookies[name].value == ''

    def test_unauthenticated_request_returns_401(self, api_client: Client) -> None:
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_request_succeeds(self, logged_in_client: Client) -> None:
        response = logged_in_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_jwt_payload_contains_expected_claims(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert response.status_code == status.HTTP_200_OK
        token = AccessToken(response.cookies['access_token'].value)
        assert token['user_id'] == create_user.pk
        assert token['token_version'] == create_user.token_version
        assert 'exp' in token


@pytest.mark.django_db
class TestTokenRefresh:

    def test_refresh_rotates_tokens(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        login_resp = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        old_access = login_resp.cookies['access_token'].value
        old_refresh = login_resp.cookies['refresh_token'].value
        response = api_client.post('/api/auth/jwt/refresh/')
        assert response.status_code == status.HTTP_200_OK
        assert 'access_token' in response.cookies
        assert 'refresh_token' in response.cookies
        assert response.cookies['access_token'].value != old_access
        assert response.cookies['refresh_token'].value != old_refresh

    def test_refresh_without_cookie_returns_401(self, api_client: Client) -> None:
        response = api_client.post('/api/auth/jwt/refresh/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_after_password_change_returns_401(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        create_user.set_password('NewSecurePass456!')
        create_user.save()
        response = api_client.post('/api/auth/jwt/refresh/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_inactive_user_returns_401(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        from datetime import timedelta

        from django.utils import timezone
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        create_user.last_active_at = timezone.now() - timedelta(days=31)
        create_user.save()
        response = api_client.post('/api/auth/jwt/refresh/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refreshed_access_token_works(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        api_client.post('/api/auth/jwt/refresh/')
        _verify_user(create_user)
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTokenVersionInvalidation:

    def test_password_change_increments_token_version(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
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

    def test_old_jwt_invalidated_after_password_change(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        login_resp = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        assert login_resp.status_code == status.HTTP_200_OK
        create_user.set_password('NewSecurePass456!')
        create_user.save()
        bad_resp = api_client.get('/api/health/')
        assert bad_resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_header_jwt_invalidated_after_password_change(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        login_resp = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        token = login_resp.cookies['access_token'].value
        api_client.cookies.clear()
        create_user.set_password('NewSecurePass456!')
        create_user.save()
        resp = api_client.get('/api/health/', HTTP_AUTHORIZATION='JWT ' + token)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_header_jwt_rejected_for_inactive_user(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        from datetime import timedelta

        from django.utils import timezone
        login_resp = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        token = login_resp.cookies['access_token'].value
        api_client.cookies.clear()
        create_user.last_active_at = timezone.now() - timedelta(days=31)
        create_user.save()
        resp = api_client.get('/api/health/', HTTP_AUTHORIZATION='JWT ' + token)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_user_can_login_with_new_password(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        create_user.set_password('NewSecurePass456!')
        create_user.save()
        response = api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': 'NewSecurePass456!',
        })
        assert response.status_code == status.HTTP_200_OK
        _verify_user(create_user)
        good_resp = api_client.get('/api/health/')
        assert good_resp.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestInactivityCheck:

    def test_inactive_user_returns_401(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        from datetime import timedelta

        from django.utils import timezone
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        create_user.last_active_at = timezone.now() - timedelta(days=31)
        create_user.save()
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_active_user_within_30_days_succeeds(self, logged_in_client: Client) -> None:
        response = logged_in_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_recently_active_user_succeeds(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        from datetime import timedelta

        from django.utils import timezone
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        _verify_user(create_user)
        create_user.last_active_at = timezone.now() - timedelta(days=1)
        create_user.save()
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_edge_case_29_days_succeeds(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        from datetime import timedelta

        from django.utils import timezone
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        _verify_user(create_user)
        create_user.last_active_at = timezone.now() - timedelta(days=29)
        create_user.save()
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_edge_case_29_days_23h_succeeds(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        from datetime import timedelta

        from django.utils import timezone
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        _verify_user(create_user)
        create_user.last_active_at = timezone.now() - timedelta(days=29, hours=23)
        create_user.save()
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_200_OK

    def test_inactive_30_days_1s_returns_401(
        self,
        api_client: Client,
        create_user: Any,
        user_data: Dict[str, str],
    ) -> None:
        from datetime import timedelta

        from django.utils import timezone
        api_client.post('/api/auth/login/', {
            'email': user_data['email'],
            'password': user_data['password'],
        })
        create_user.last_active_at = timezone.now() - timedelta(days=30, seconds=1)
        create_user.save()
        response = api_client.get('/api/health/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestDjangoAdmin:

    def test_staff_user_can_access_admin(self, api_client: Client) -> None:
        staff = User.objects.create_superuser(
            email='staff@example.com',
            password='staffpass123',
        )
        api_client.force_login(staff)
        response = api_client.get('/admin/')
        assert response.status_code == status.HTTP_200_OK

    def test_non_staff_user_redirected_from_admin(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        api_client.force_login(create_user)
        response = api_client.get('/admin/')
        assert response.status_code in (status.HTTP_302_FOUND, status.HTTP_403_FORBIDDEN)

    def test_admin_user_list_shows_user_model(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        staff = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123',
        )
        api_client.force_login(staff)
        response = api_client.get('/admin/accounts/user/')
        assert response.status_code == status.HTTP_200_OK
        assert create_user.email in response.content.decode()

    def test_admin_user_change_view_renders_customized_fieldsets(
        self,
        api_client: Client,
        create_user: Any,
    ) -> None:
        staff = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123',
        )
        api_client.force_login(staff)
        response = api_client.get(f'/admin/accounts/user/{create_user.pk}/change/')
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert create_user.email in content
        assert 'Activity' in content

    def test_unauthenticated_user_redirected_from_admin(self, api_client: Client) -> None:
        response = api_client.get('/admin/')
        assert response.status_code == status.HTTP_302_FOUND
