from django.urls import path

from apps.billing.webhooks import chargily_webhook

app_name = 'billing_webhooks'

urlpatterns = [
    path('chargily/', chargily_webhook, name='chargily'),
]
