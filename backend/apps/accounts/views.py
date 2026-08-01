from typing import Any, Dict, List

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in
from django.db import transaction
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

from tasks.email_tasks import send_verification_email

from .auth import (
    TokenWithVersionAccessToken,
    TokenWithVersionRefreshToken,
    touch_activity,
    validate_user_token,
)
from .models import LOCALE_CHOICES, SingleUseToken
from .serializers import SignupSerializer
from .tokens import create_single_use_token

User = get_user_model()

FREE_SIGNUP_CREDITS: int = 15


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
        validate_user_token(user, refresh)
        touch_activity(user)
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


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        locale = request.COOKIES.get('x-locale') or 'ar'
        if locale not in dict(LOCALE_CHOICES):
            locale = 'ar'
        user = User.objects.create_user(
            email=data['email'],
            password=data['password'],
            locale=locale,
        )
        create_single_use_token(user, purpose='verify')
        send_verification_email.delay(user.pk)
        return Response(
            {'detail': 'Signup successful. Please verify your email.', 'email': user.email},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, token: str) -> Response:
        try:
            entry = SingleUseToken.objects.get(token=token, purpose='verify')
        except SingleUseToken.DoesNotExist:
            return Response(
                {'detail': 'Invalid verification link', 'code': 'token_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        with transaction.atomic():
            entry = SingleUseToken.objects.select_for_update().get(pk=entry.pk)
            if entry.consumed_at is not None:
                return Response(
                    {'detail': 'Verification link has already been used', 'code': 'token_used'},
                    status=status.HTTP_410_GONE,
                )
            if entry.expires_at <= timezone.now():
                return Response(
                    {'detail': 'Verification link has expired', 'code': 'token_expired'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = User.objects.select_for_update().get(pk=entry.user_id)
            entry.consumed_at = timezone.now()
            entry.save(update_fields=['consumed_at'])
            if user.email_verified_at is None:
                user.email_verified_at = timezone.now()
                user.credits_balance += FREE_SIGNUP_CREDITS
                user.save(update_fields=['email_verified_at', 'credits_balance'])
                return Response(
                    {'detail': 'Email verified', 'code': 'verified'},
                    status=status.HTTP_200_OK,
                )
            return Response(
                {'detail': 'Email already verified', 'code': 'already_verified'},
                status=status.HTTP_200_OK,
            )


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        email = str(request.data.get('email') or '').lower().strip()
        if email:
            user = User.objects.filter(email=email).first()
            if user is not None and user.email_verified_at is None:
                now = timezone.now()
                SingleUseToken.objects.filter(
                    user=user, purpose='verify', consumed_at__isnull=True,
                ).update(consumed_at=now)
                create_single_use_token(user, purpose='verify')
                send_verification_email.delay(user.pk)
        return Response(
            {'detail': 'If an account exists for this email, a verification link has been sent.'},
            status=status.HTTP_200_OK,
        )
