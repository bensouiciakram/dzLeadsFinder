from django.urls import path

from apps.search.views import (
    ChecklistView,
    CompanySearchView,
    PeopleSearchView,
    SavedSearchDetailView,
    SavedSearchListView,
)

app_name = 'search'

urlpatterns = [
    path('people/', PeopleSearchView.as_view(), name='people-search'),
    path('companies/', CompanySearchView.as_view(), name='company-search'),
    path('saved/', SavedSearchListView.as_view(), name='saved-search-list'),
    path('saved/<uuid:pk>/', SavedSearchDetailView.as_view(), name='saved-search-detail'),
    path('checklist/', ChecklistView.as_view(), name='checklist'),
]
