from datetime import timedelta
from typing import Any, Optional, Tuple, cast

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken, Token


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request: Request) -> Optional[Tuple[Any, Any]]:
        raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])
        if raw_token:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            self._check_user(user, validated_token)
            return user, validated_token
        result = super().authenticate(request)
        if result is None:
            return None
        user, validated_token = result
        self._check_user(user, validated_token)
        return user, validated_token

    def _check_user(self, user: Any, validated_token: Token) -> None:
        token_version = validated_token.get('token_version', 0)
        if user.token_version != token_version:
            raise AuthenticationFailed('Token has been invalidated', code='token_not_valid')
        if user.deleted_at is not None or user.deletion_scheduled_at is not None:
            raise AuthenticationFailed('Account has been deleted', code='account_deleted')
        if user.last_active_at <= timezone.now() - timedelta(days=30):
            raise AuthenticationFailed('Session expired due to inactivity', code='session_expired')
        if user.last_active_at < timezone.now() - timedelta(minutes=1):
            user.last_active_at = timezone.now()
            user.save(update_fields=['last_active_at'])


class TokenWithVersionAccessToken(AccessToken):
    @classmethod
    def for_user(cls, user: Any) -> 'TokenWithVersionAccessToken':
        token = super().for_user(user)
        token['token_version'] = user.token_version
        return token


class TokenWithVersionRefreshToken(RefreshToken):
    @classmethod
    def for_user(cls, user: Any) -> 'TokenWithVersionRefreshToken':
        token = cast(TokenWithVersionRefreshToken, super().for_user(user))
        token['token_version'] = user.token_version
        return token
