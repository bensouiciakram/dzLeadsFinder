import math
from datetime import timedelta
from typing import Any, List, Optional, Tuple, cast

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError

from .auth import TokenWithVersionAccessToken

User = get_user_model()

DELETION_GRACE_DAYS: int = 7


def _frozen_user_from_cookie(request: Request) -> Tuple[Any, Optional[Response]]:
    raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])
    if not raw_token:
        return None, Response(
            {'detail': 'Access token not provided', 'code': 'token_not_provided'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    try:
        token = TokenWithVersionAccessToken(raw_token)
        token.check_exp()
    except TokenError:
        return None, Response(
            {'detail': 'Invalid or expired access token', 'code': 'token_not_valid'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    user_id = token.get('user_id')
    if user_id is None:
        return None, Response(
            {'detail': 'Invalid access token', 'code': 'token_not_valid'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None, Response(
            {'detail': 'Invalid access token', 'code': 'token_not_valid'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    if token.get('token_version', 0) != user.token_version:
        return None, Response(
            {'detail': 'Token has been invalidated', 'code': 'token_not_valid'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return user, None


def _is_frozen(user: Any) -> bool:
    return user.deleted_at is not None or user.deletion_scheduled_at is not None


def _days_left(deletion_scheduled_at: Any) -> int:
    remaining = cast(timedelta, deletion_scheduled_at - timezone.now())
    return max(0, math.ceil(remaining.total_seconds() / 86400))


class AccountDeleteView(APIView):
    def post(self, request: Request) -> Response:
        user = request.user
        now = timezone.now()
        user.deleted_at = now
        user.deletion_scheduled_at = now + timedelta(days=DELETION_GRACE_DAYS)
        user.save(update_fields=['deleted_at', 'deletion_scheduled_at'])
        return Response(
            {'deletion_scheduled_at': user.deletion_scheduled_at.isoformat()},
            status=status.HTTP_200_OK,
        )


class FrozenStatusView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: List[Any] = []

    def get(self, request: Request) -> Response:
        user, error = _frozen_user_from_cookie(request)
        if error is not None:
            return error
        if not _is_frozen(user):
            return Response(
                {'detail': 'Account is not frozen', 'code': 'not_frozen'},
                status=status.HTTP_404_NOT_FOUND,
            )
        scheduled: Optional[Any] = user.deletion_scheduled_at
        return Response({
            'deletion_scheduled_at': scheduled.isoformat() if scheduled is not None else None,
            'days_left': _days_left(scheduled) if scheduled is not None else 0,
        })


class AccountUndeleteView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: List[Any] = []

    def post(self, request: Request) -> Response:
        user, error = _frozen_user_from_cookie(request)
        if error is not None:
            return error
        if not user.is_active:
            return Response(
                {'detail': 'Account is inactive', 'code': 'account_inactive'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not _is_frozen(user):
            return Response(
                {'detail': 'Account is not frozen', 'code': 'not_frozen'},
                status=status.HTTP_409_CONFLICT,
            )
        if (
            user.deletion_scheduled_at is None
            or user.deletion_scheduled_at <= timezone.now()
        ):
            return Response(
                {'detail': 'The deletion grace period has expired', 'code': 'irreversible'},
                status=status.HTTP_409_CONFLICT,
            )
        user.deleted_at = None
        user.deletion_scheduled_at = None
        user.save(update_fields=['deleted_at', 'deletion_scheduled_at'])
        return Response(
            {'detail': 'Account recovered', 'code': 'account_recovered'},
            status=status.HTTP_200_OK,
        )
