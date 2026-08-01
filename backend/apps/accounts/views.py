from datetime import timedelta
from typing import Any, Dict, List

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in
from django.utils import timezone
from djoser.serializers import TokenCreateSerializer as DjoserTokenCreateSerializer
from djoser.views import TokenCreateView as DjoserTokenCreateView
from djoser.views import TokenDestroyView as DjoserTokenDestroyView
from rest_framework import permissions, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError

from .auth import TokenWithVersionAccessToken, TokenWithVersionRefreshToken

User = get_user_model()


class CaseInsensitiveTokenCreateSerializer(DjoserTokenCreateSerializer):
    def validate(self, attrs: Dict[str, Any]) -> Any:
        email = attrs.get('email')
        if isinstance(email, str):
            attrs['email'] = email.lower()
        return super().validate(attrs)


def _set_cookie(response: Response, key: str, value: str, path: str) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
        secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
        samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
        path=path,
    )


class TokenCreateView(DjoserTokenCreateView):
    serializer_class = CaseInsensitiveTokenCreateSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        access_token = TokenWithVersionAccessToken.for_user(user)
        refresh_token = TokenWithVersionRefreshToken.for_user(user)
        now = timezone.now()
        user.last_active_at = now
        user.last_login = now
        user.save(update_fields=['last_active_at', 'last_login'])
        user_logged_in.send(sender=User, request=request, user=user)
        response = Response(
            {'detail': 'Login successful'},
            status=status.HTTP_200_OK,
        )
        _set_cookie(
            response,
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            value=str(access_token),
            path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
        )
        _set_cookie(
            response,
            key=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],
            value=str(refresh_token),
            path=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH_PATH'],
        )
        return response


class TokenRefreshView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: List[Any] = []

    def handle_exception(self, exc: Exception) -> Response:
        if isinstance(exc, AuthenticationFailed):
            return Response(
                {'detail': exc.detail, 'code': exc.get_codes()},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return super().handle_exception(exc)

    def post(self, request: Request) -> Response:
        raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
        if not raw_token:
            raise AuthenticationFailed('Refresh token not provided', code='token_not_provided')
        try:
            refresh = TokenWithVersionRefreshToken(raw_token)
            refresh.check_exp()
        except TokenError:
            raise AuthenticationFailed('Invalid or expired refresh token', code='token_not_valid')
        user = User.objects.get(pk=refresh['user_id'])
        if user.token_version != refresh.get('token_version', 0):
            raise AuthenticationFailed('Token has been invalidated', code='token_not_valid')
        if (
            not user.is_active
            or user.deleted_at is not None
            or user.deletion_scheduled_at is not None
        ):
            raise AuthenticationFailed('Account is not active', code='account_inactive')
        if user.last_active_at <= timezone.now() - timedelta(days=30):
            raise AuthenticationFailed('Session expired due to inactivity', code='session_expired')
        user.last_active_at = timezone.now()
        user.save(update_fields=['last_active_at'])
        access_token = TokenWithVersionAccessToken.for_user(user)
        new_refresh = TokenWithVersionRefreshToken.for_user(user)
        response = Response(
            {'detail': 'Token refreshed'},
            status=status.HTTP_200_OK,
        )
        _set_cookie(
            response,
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            value=str(access_token),
            path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
        )
        _set_cookie(
            response,
            key=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],
            value=str(new_refresh),
            path=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH_PATH'],
        )
        return response


class TokenDestroyView(DjoserTokenDestroyView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: List[Any] = []

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        response = Response(
            {'detail': 'Logout successful'},
            status=status.HTTP_200_OK,
        )
        response.delete_cookie(
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
        )
        response.delete_cookie(
            key=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],
            path=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH_PATH'],
        )
        return response
