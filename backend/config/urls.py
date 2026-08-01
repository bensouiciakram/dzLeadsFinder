from django.contrib import admin
from django.urls import include, path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def health_check(request):
    return Response({"status": "ok"})

urlpatterns = [
    path('api/health/', health_check, name='health-check'),
    path('api/auth/', include('djoser.urls')),
    path('api/auth/', include('apps.accounts.urls')),
    path('admin/', admin.site.urls),
]
