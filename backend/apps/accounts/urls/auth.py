from django.urls import path

from ..views.auth import (
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ResendVerificationView,
    SignupView,
    TokenCreateView,
    TokenDestroyView,
    TokenRefreshView,
    VerifyEmailView,
)

urlpatterns = [
    path('login/', TokenCreateView.as_view(), name='login'),
    path('logout/', TokenDestroyView.as_view(), name='logout'),
    path('jwt/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('signup/', SignupView.as_view(), name='signup'),
    path(
        'verify-email/<str:token>/',
        VerifyEmailView.as_view(),
        name='verify-email',
    ),
    path(
        'resend-verification/',
        ResendVerificationView.as_view(),
        name='resend-verification',
    ),
    path('me/', MeView.as_view(), name='me'),
    path(
        'password-reset/',
        PasswordResetRequestView.as_view(),
        name='password-reset-request',
    ),
    path(
        'password-reset/<str:token>/',
        PasswordResetConfirmView.as_view(),
        name='password-reset-confirm',
    ),
]
