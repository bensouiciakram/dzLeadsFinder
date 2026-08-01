from django.urls import path

from . import views

urlpatterns = [
    path('login/', views.TokenCreateView.as_view(), name='login'),
    path('logout/', views.TokenDestroyView.as_view(), name='logout'),
    path('jwt/refresh/', views.TokenRefreshView.as_view(), name='token-refresh'),
]
