from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import AccessToken


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get('access_token')
        if raw_token:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            token_version = validated_token.get('token_version', 0)
            if user.token_version != token_version:
                raise AuthenticationFailed('Token has been invalidated', code='token_not_valid')
            if user.last_active_at <= timezone.now() - timedelta(days=30):
                raise AuthenticationFailed('Session expired due to inactivity', code='session_expired')
            if user.last_active_at < timezone.now() - timedelta(minutes=1):
                user.last_active_at = timezone.now()
                user.save(update_fields=['last_active_at'])
            return (user, validated_token)
        return super().authenticate(request)


class TokenWithVersionAccessToken(AccessToken):
    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        token['token_version'] = user.token_version
        return token
