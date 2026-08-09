from django.urls import path

from apps.billing.views import CreateCheckoutView

app_name = 'billing'

urlpatterns = [
    path('create-checkout/', CreateCheckoutView.as_view(), name='create-checkout'),
]
