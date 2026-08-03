from datetime import timedelta
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from tasks.maintenance_tasks import hard_delete_expired

User = get_user_model()


def _expire(user: Any) -> None:
    user.deleted_at = timezone.now()
    user.deletion_scheduled_at = timezone.now() - timedelta(hours=1)
    user.save(update_fields=['deleted_at', 'deletion_scheduled_at'])


def _freeze(user: Any) -> None:
    user.deleted_at = timezone.now()
    user.deletion_scheduled_at = timezone.now() + timedelta(days=7)
    user.save(update_fields=['deleted_at', 'deletion_scheduled_at'])


@pytest.mark.django_db
class TestHardDeleteExpired:

    def test_hard_deletes_expired_user_and_their_tokens(self, create_user: Any) -> None:
        from apps.accounts.models import SingleUseToken

        _expire(create_user)
        token = SingleUseToken.objects.create(
            user=create_user,
            purpose='verify',
            token='expired-user-token',
            expires_at=timezone.now() + timedelta(days=1),
        )
        assert User.objects.filter(pk=create_user.pk).exists()
        hard_delete_expired()
        assert not User.objects.filter(pk=create_user.pk).exists()
        assert not SingleUseToken.objects.filter(pk=token.pk).exists()

    def test_is_idempotent_across_runs(self, create_user: Any) -> None:
        _expire(create_user)
        hard_delete_expired()
        assert not User.objects.filter(pk=create_user.pk).exists()
        hard_delete_expired()
        assert not User.objects.filter(pk=create_user.pk).exists()

    def test_keeps_users_still_in_grace(self, create_user: Any) -> None:
        _freeze(create_user)
        hard_delete_expired()
        assert User.objects.filter(pk=create_user.pk).exists()
        create_user.refresh_from_db()
        assert create_user.deleted_at is not None
        assert create_user.deletion_scheduled_at is not None

    def test_skips_users_without_a_schedule(self, create_user: Any) -> None:
        create_user.deleted_at = timezone.now()
        create_user.save(update_fields=['deleted_at'])
        hard_delete_expired()
        assert User.objects.filter(pk=create_user.pk).exists()

    def test_leaves_active_users_untouched(self, create_user: Any) -> None:
        hard_delete_expired()
        assert User.objects.filter(pk=create_user.pk).exists()
