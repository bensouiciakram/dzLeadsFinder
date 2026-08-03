from typing import Any, Dict, List, cast

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.signals import user_logged_in
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
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

from tasks.email_tasks import send_password_reset_email, send_verification_email

from .auth import (
    TokenWithVersionAccessToken,
    TokenWithVersionRefreshToken,
    touch_activity,
    validate_user_token,
)
from .models import LOCALE_CHOICES, SingleUseToken
from .serializers import SignupSerializer
from .tokens import RESET_TOKEN_TTL, create_single_use_token

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
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    email=data['email'],
                    password=data['password'],
                    locale=locale,
                )
                create_single_use_token(user, purpose='verify')
                send_verification_email.delay(user.pk)
        except IntegrityError:
            return Response(
                {'email': ['A user with this email address already exists.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
            try:
                user = User.objects.select_for_update().get(pk=entry.user_id)
            except User.DoesNotExist:
                return Response(
                    {'detail': 'Invalid verification link', 'code': 'token_not_found'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if user.deleted_at is not None or user.deletion_scheduled_at is not None:
                return Response(
                    {'detail': 'Invalid verification link', 'code': 'token_not_found'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if entry.consumed_at is not None:
                if user.email_verified_at is not None:
                    return Response(
                        {'detail': 'Email already verified', 'code': 'already_verified'},
                        status=status.HTTP_200_OK,
                    )
                return Response(
                    {'detail': 'Verification link has already been used', 'code': 'token_used'},
                    status=status.HTTP_410_GONE,
                )
            if entry.expires_at <= timezone.now():
                return Response(
                    {'detail': 'Verification link has expired', 'code': 'token_expired'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
        if isinstance(request.data, dict):
            email = str(request.data.get('email') or '').lower().strip()
            if email:
                user = User.objects.filter(email=email, deleted_at__isnull=True).first()
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


class MeView(APIView):
    def get(self, request: Request) -> Response:
        user = request.user
        return Response({
            'email': user.email,
            'locale': user.locale,
            'tier': user.tier,
            'credits_balance': user.credits_balance,
            'email_verified_at': (
                user.email_verified_at.isoformat() if user.email_verified_at is not None else None
            ),
        })


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: List[Any] = []

    def post(self, request: Request) -> Response:
        if isinstance(request.data, dict):
            email = str(request.data.get('email') or '').lower().strip()
            if email:
                user = User.objects.filter(
                    email=email,
                    deleted_at__isnull=True,
                    deletion_scheduled_at__isnull=True,
                ).first()
                if user is not None:
                    now = timezone.now()
                    SingleUseToken.objects.filter(
                        user=user, purpose='reset', consumed_at__isnull=True,
                    ).update(consumed_at=now)
                    token = create_single_use_token(
                        user, purpose='reset', ttl=RESET_TOKEN_TTL,
                    )
                    send_password_reset_email.delay(user.pk, token.pk)
        return Response(
            {'detail': 'If an account exists with this email, a reset link has been sent.'},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: List[Any] = []

    def _get_token_entry(self, token: str) -> SingleUseToken | None:
        try:
            return cast(
                SingleUseToken,
                SingleUseToken.objects.get(token=token, purpose='reset'),
            )
        except SingleUseToken.DoesNotExist:
            return None

    def _require_token_entry(self, token: str) -> SingleUseToken | Response:
        entry = self._get_token_entry(token)
        if entry is None:
            return Response(
                {'detail': 'Invalid reset link', 'code': 'token_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return entry

    def _reject_user(self, user: Any) -> bool:
        return user.deleted_at is not None or user.deletion_scheduled_at is not None

    def _validated_response(self, entry: SingleUseToken, user: Any) -> Response | None:
        if self._reject_user(user):
            return Response(
                {'detail': 'Invalid reset link', 'code': 'token_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if entry.consumed_at is not None:
            return Response(
                {'detail': 'Reset link has already been used', 'code': 'token_used'},
                status=status.HTTP_410_GONE,
            )
        if entry.expires_at <= timezone.now():
            return Response(
                {'detail': 'Reset link has expired', 'code': 'token_expired'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def get(self, request: Request, token: str) -> Response:
        entry = self._require_token_entry(token)
        if isinstance(entry, Response):
            return entry
        try:
            user = User.objects.get(pk=entry.user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Invalid reset link', 'code': 'token_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        rejected = self._validated_response(entry, user)
        if rejected is not None:
            return rejected
        return Response({'detail': 'Reset link is valid', 'code': 'token_valid'})

    def post(self, request: Request, token: str) -> Response:
        if not isinstance(request.data, dict):
            return Response(
                {'detail': 'Invalid request body', 'code': 'invalid_request'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry = self._require_token_entry(token)
        if isinstance(entry, Response):
            return entry
        with transaction.atomic():
            try:
                locked_entry = cast(
                    SingleUseToken,
                    SingleUseToken.objects.select_for_update().get(pk=entry.pk),
                )
            except SingleUseToken.DoesNotExist:
                return Response(
                    {'detail': 'Invalid reset link', 'code': 'token_not_found'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            try:
                user = User.objects.select_for_update().get(pk=locked_entry.user_id)
            except User.DoesNotExist:
                return Response(
                    {'detail': 'Invalid reset link', 'code': 'token_not_found'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            rejected = self._validated_response(locked_entry, user)
            if rejected is not None:
                return rejected
            password = request.data.get('password')
            if not isinstance(password, str) or len(password) > 128:
                return Response(
                    {'password': ['Password must be at most 128 characters.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                validate_password(password, user=user)
            except ValidationError as exc:
                return Response(
                    {'password': list(exc.messages)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.set_password(password)
            user.save(update_fields=['password', 'token_version'])
            locked_entry.consumed_at = timezone.now()
            locked_entry.save(update_fields=['consumed_at'])
        return Response(
            {'detail': 'Password reset successfully', 'code': 'password_reset'},
            status=status.HTTP_200_OK,
        )
