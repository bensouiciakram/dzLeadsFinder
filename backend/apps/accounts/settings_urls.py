from django.urls import path

from . import settings_views

urlpatterns = [
    path('delete/', settings_views.AccountDeleteView.as_view(), name='settings-delete'),
    path(
        'undelete/',
        settings_views.AccountUndeleteView.as_view(),
        name='settings-undelete',
    ),
    path(
        'frozen-status/',
        settings_views.FrozenStatusView.as_view(),
        name='settings-frozen-status',
    ),
]
