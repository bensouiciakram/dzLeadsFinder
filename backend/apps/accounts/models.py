from typing import Any, List, Optional

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: Optional[str], **extra_fields: Any) -> Any:
        if not email:
            raise ValueError('The given email must be set')
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: Optional[str] = None, **extra_fields: Any) -> Any:
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(
        self,
        email: str,
        password: Optional[str] = None,
        **extra_fields: Any,
    ) -> Any:
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self._create_user(email, password, **extra_fields)


LOCALE_CHOICES = [
    ('ar', 'Arabic'),
    ('fr', 'French'),
    ('en', 'English'),
]
TIER_CHOICES = [
    ('free', 'Free'),
    ('starter', 'Starter'),
]


class User(AbstractBaseUser, PermissionsMixin):
    locale = models.CharField(max_length=2, choices=LOCALE_CHOICES, default='ar')
    tier = models.CharField(max_length=10, choices=TIER_CHOICES, default='free')
    credits_balance = models.IntegerField(default=0)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    last_active_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deletion_scheduled_at = models.DateTimeField(null=True, blank=True)
    checklist_dismissed_at = models.DateTimeField(null=True, blank=True)
    credits_banner_dismissed_at = models.DateTimeField(null=True, blank=True)
    token_version = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    email = models.EmailField(unique=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS: List[str] = []

    class Meta:
        db_table = 'users'
        ordering = ['-date_joined']

    def set_password(self, raw_password: str) -> None:
        super().set_password(raw_password)
        if self.pk is not None:
            self.token_version += 1

    def __str__(self) -> str:
        return str(self.email)


TOKEN_PURPOSE_CHOICES = [
    ('verify', 'Email verification'),
    ('reset', 'Password reset'),
]


class SingleUseToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='single_use_tokens',
    )
    purpose = models.CharField(max_length=10, choices=TOKEN_PURPOSE_CHOICES, default='verify')
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'single_use_tokens'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.purpose} token for {self.user_id} ({self.created_at:%Y-%m-%d})'
