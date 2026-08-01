from django.urls import path

from . import views

urlpatterns = [
    path('login/', views.TokenCreateView.as_view(), name='login'),
    path('logout/', views.TokenDestroyView.as_view(), name='logout'),
    path('jwt/refresh/', views.TokenRefreshView.as_view(), name='token-refresh'),
    path('signup/', views.SignupView.as_view(), name='signup'),
    path(
        'verify-email/<str:token>/',
        views.VerifyEmailView.as_view(),
        name='verify-email',
    ),
    path(
        'resend-verification/',
        views.ResendVerificationView.as_view(),
        name='resend-verification',
    ),
]
