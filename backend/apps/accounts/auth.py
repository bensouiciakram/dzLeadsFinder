from datetime import timedelta
from typing import Any, Optional, Tuple, cast
from uuid import uuid4

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken, Token


def validate_user_token(user: Any, token: Token) -> None:
    token_version = token.get('token_version', 0)
    if user.token_version != token_version:
        raise AuthenticationFailed('Token has been invalidated', code='token_not_valid')
    if not user.is_active:
        raise AuthenticationFailed('Account is inactive', code='account_inactive')
    if user.is_frozen:
        raise AuthenticationFailed('Account has been deleted', code='account_deleted')
    if user.last_active_at <= timezone.now() - timedelta(days=30):
        raise AuthenticationFailed('Session expired due to inactivity', code='session_expired')


def check_email_verified(user: Any) -> None:
    if user.email_verified_at is None:
        raise AuthenticationFailed('Email not verified', code='email_not_verified')


def touch_activity(user: Any) -> None:
    if user.last_active_at < timezone.now() - timedelta(minutes=1):
        user.last_active_at = timezone.now()
        user.save(update_fields=['last_active_at'])


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request: Request) -> Optional[Tuple[Any, Any]]:
        raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])
        if raw_token:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            validate_user_token(user, validated_token)
            check_email_verified(user)
            touch_activity(user)
            return user, validated_token
        result = super().authenticate(request)
        if result is None:
            return None
        user, validated_token = result
        validate_user_token(user, validated_token)
        check_email_verified(user)
        touch_activity(user)
        return user, validated_token


def _apply_version_claims(token: Token, user: Any) -> None:
    """The shared JWT claims: the token_version (password-change invalidation)
    and a fresh jti. Both token classes would drift if spelled twice."""
    token['token_version'] = user.token_version
    token['jti'] = str(uuid4())


class TokenWithVersionAccessToken(AccessToken):
    @classmethod
    def for_user(cls, user: Any) -> 'TokenWithVersionAccessToken':
        token = super().for_user(user)
        _apply_version_claims(token, user)
        return token


class TokenWithVersionRefreshToken(RefreshToken):
    @classmethod
    def for_user(cls, user: Any) -> 'TokenWithVersionRefreshToken':
        token = cast(TokenWithVersionRefreshToken, super().for_user(user))
        _apply_version_claims(token, user)
        return token
