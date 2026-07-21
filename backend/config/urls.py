from django.contrib import admin
from django.http import JsonResponse
from django.urls import path


def health_check(request: object) -> JsonResponse:
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path('api/health/', health_check, name='health-check'),
    path('admin/', admin.site.urls),
]
