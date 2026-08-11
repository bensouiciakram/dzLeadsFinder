from django.urls import path

from apps.billing.views import (
    CancelView,
    CreateCheckoutView,
    HistoryView,
    PacksView,
    PlanView,
    StatusView,
)

app_name = 'billing'

urlpatterns = [
    path('create-checkout/', CreateCheckoutView.as_view(), name='create-checkout'),
    path('plan/', PlanView.as_view(), name='plan'),
    path('packs/', PacksView.as_view(), name='packs'),
    path('history/', HistoryView.as_view(), name='history'),
    path('cancel/', CancelView.as_view(), name='cancel'),
    path('status/<str:txn_id>/', StatusView.as_view(), name='status'),
]
