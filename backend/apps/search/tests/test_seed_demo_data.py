import uuid
from typing import Any, Callable

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client
from django.utils import timezone

from apps.search.filters import SENIORITY_BANDS, SIZE_BANDS
from apps.search.models import Company, Person

User = get_user_model()

_Session = Callable[..., tuple[Client, Any]]

pytestmark = pytest.mark.django_db


@pytest.fixture
def search_session(api_client: Client) -> _Session:
    def _login(locale: str = 'en') -> tuple[Client, Any]:
        email = f'{uuid.uuid4().hex}@example.com'
        user = User.objects.create_user(
            email=email, password='SecurePass123!', locale=locale
        )
        user.email_verified_at = timezone.now()
        user.save(update_fields=['email_verified_at'])
        api_client.post('/api/auth/login/', {'email': email, 'password': 'SecurePass123!'})
        return api_client, user

    return _login


class TestSeedDemoData:
    def test_refuses_to_overwrite_existing_data_without_force(self) -> None:
        Company.objects.create(name='Existing Co', source='test')
        with pytest.raises(CommandError):
            call_command('seed_demo_data')
        assert Company.objects.count() == 1

    def test_seeds_companies_and_people_with_normalized_search(self) -> None:
        call_command('seed_demo_data', companies=6, people=10)

        assert Company.objects.count() == 6
        assert Person.objects.count() == 10
        for company in Company.objects.all():
            assert company.source == 'demo'
            assert company.industry_id is not None
            assert company.wilaya_code_id is not None
            assert company.size_band in SIZE_BANDS
            assert company.search_normalized != ''
        for person in Person.objects.all():
            assert person.source == 'demo'
            assert person.seniority in SENIORITY_BANDS
            assert person.search_normalized != ''

    def test_produces_both_company_less_people_and_zero_contact_companies(self) -> None:
        call_command('seed_demo_data', companies=8, people=12)

        assert Person.objects.filter(company__isnull=True).exists()
        assert Company.objects.filter(people__isnull=True).exists()

    def test_force_replaces_existing_rows(self) -> None:
        call_command('seed_demo_data', companies=3, people=3)
        first_id = Company.objects.first().id
        Company.objects.filter(id=first_id).update(name='Mutated Co')

        call_command('seed_demo_data', companies=4, people=5, force=True)

        assert Company.objects.count() == 4
        assert Person.objects.count() == 5
        assert not Company.objects.filter(id=first_id).exists()
        assert not Company.objects.filter(name='Mutated Co').exists()

    def test_seeded_data_is_searchable_through_the_api(self, search_session: _Session) -> None:
        call_command('seed_demo_data', companies=10, people=25)
        client, _ = search_session()

        people_response = client.get('/api/search/people/')
        assert people_response.status_code == 200
        assert people_response.json()['total'] == 25

        companies_response = client.get('/api/search/companies/')
        assert companies_response.status_code == 200
        assert companies_response.json()['total'] == 10
        assert companies_response.json()['results'][0]['people_count'] is not None

    def test_keyword_search_finds_seeded_rows(self, search_session: _Session) -> None:
        call_command('seed_demo_data', companies=10, people=25)
        client, _ = search_session()

        sample = Company.objects.exclude(name__contains='\u0623').first()
        keyword = sample.name.split()[0]
        response = client.get(
            '/api/search/companies/', {'filters': '{"keyword": "%s"}' % keyword}
        )
        assert response.status_code == 200
        assert response.json()['total'] >= 1
