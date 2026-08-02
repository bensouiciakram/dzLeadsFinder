import secrets
from datetime import timedelta
from typing import Any, cast

from django.utils import timezone

from .models import SingleUseToken

TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)


def create_single_use_token(
    user: Any,
    purpose: str = 'verify',
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
