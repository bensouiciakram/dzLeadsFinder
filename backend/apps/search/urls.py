from django.urls import path

from apps.search.views import CompanySearchView, PeopleSearchView

app_name = 'search'

urlpatterns = [
    path('people/', PeopleSearchView.as_view(), name='people-search'),
    path('companies/', CompanySearchView.as_view(), name='company-search'),
]
