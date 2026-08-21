import secrets
from datetime import timedelta
from typing import Any, cast

from django.utils import timezone

from .models import TOKEN_PURPOSE_VERIFY, SingleUseToken

TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)


def create_single_use_token(
    user: Any,
    purpose: str = TOKEN_PURPOSE_VERIFY,
    ttl: timedelta = TOKEN_TTL,
) -> SingleUseToken:
    return cast(
        SingleUseToken,
        SingleUseToken.objects.create(
            user=user,
            purpose=purpose,
            token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + ttl,
        ),
    )


def invalidate_pending_tokens(user: Any, purpose: str) -> None:
    """Consume every outstanding unconsumed token for the purpose — an old
    link can never be used after a fresh one is issued (the resend flows'
    shared sweep)."""
    SingleUseToken.objects.filter(
        user=user, purpose=purpose, consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())


def get_token_entry(token: str, purpose: str) -> SingleUseToken | None:
    """The by-token+purpose lookup both confirm views share; ``None`` maps to
    each view's own not-found contract."""
    try:
        return cast(
            SingleUseToken,
            SingleUseToken.objects.get(token=token, purpose=purpose),
        )
    except SingleUseToken.DoesNotExist:
        return None
