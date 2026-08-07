from django.urls import path

from apps.exports.views import ExportDownloadView, ExportView

app_name = 'exports'

urlpatterns = [
    path('', ExportView.as_view(), name='export-create'),
    path(
        '<str:export_id>/download/',
        ExportDownloadView.as_view(),
        name='export-download',
    ),
]
