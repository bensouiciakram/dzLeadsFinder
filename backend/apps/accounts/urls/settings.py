from django.urls import path

from ..views.settings import (
    AccountDeleteView,
    AccountUndeleteView,
    FrozenStatusView,
)

urlpatterns = [
    path('delete/', AccountDeleteView.as_view(), name='settings-delete'),
    path(
        'undelete/',
        AccountUndeleteView.as_view(),
        name='settings-undelete',
    ),
    path(
        'frozen-status/',
        FrozenStatusView.as_view(),
        name='settings-frozen-status',
    ),
]
