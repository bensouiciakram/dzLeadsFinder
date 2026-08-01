from django.contrib import admin
from django.urls import include, path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response


@api_view(['GET'])  # type: ignore[misc]
@permission_classes([IsAuthenticated])  # type: ignore[misc]
def health_check(request: Request) -> Response:
    return Response({"status": "ok"})


@api_view(['GET'])  # type: ignore[misc]
@permission_classes([AllowAny])  # type: ignore[misc]
def health_live(request: Request) -> Response:
    return Response({"status": "ok"})

urlpatterns = [
    path('api/health/', health_check, name='health-check'),
    path('api/health/live/', health_live, name='health-live'),
    path('api/auth/', include('djoser.urls')),
    path('api/auth/', include('apps.accounts.urls')),
    path('admin/', admin.site.urls),
]
