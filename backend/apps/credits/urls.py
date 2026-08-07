from django.urls import path

from apps.credits.views import CreditsLedgerView, RevealView

app_name = 'credits'

urlpatterns = [
    path(
        '<str:record_type>/<str:record_id>/',
        RevealView.as_view(),
        name='reveal',
    ),
    path('ledger/', CreditsLedgerView.as_view(), name='credits-ledger'),
]
