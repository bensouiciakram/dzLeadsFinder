import json
import uuid
from typing import Any, Callable

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.search.models import Company, DailyUsage, Industry, Person, Wilaya

User = get_user_model()

_Session = Callable[..., tuple[Client, Any]]

pytestmark = pytest.mark.django_db


@pytest.fixture
def search_session(api_client: Client) -> _Session:
    def _login(locale: str = 'en', tier: str = 'free') -> tuple[Client, Any]:
        email = f'{uuid.uuid4().hex}@example.com'
        user = User.objects.create_user(
            email=email, password='SecurePass123!', locale=locale, tier=tier
        )
        user.email_verified_at = timezone.now()
        user.save(update_fields=['email_verified_at'])
        api_client.post('/api/auth/login/', {'email': email, 'password': 'SecurePass123!'})
        return api_client, user

    return _login


def _industry(name_en: str) -> Any:
    name = f'{name_en} {uuid.uuid4().hex[:6]}'
    return Industry.objects.create(name_ar=name, name_fr=name, name_en=name)


def _company(
    name: str, *, industry: Any = None, wilaya: Any = None, size_band: str | None = None
) -> Any:
    return Company.objects.create(
        name=name, industry=industry, wilaya_code=wilaya, size_band=size_band, source='test'
    )


def _person(
    name: str, *, role: str | None = None, seniority: str | None = None, company: Any = None
) -> Any:
    return Person.objects.create(
        name=name, role=role, seniority=seniority, company=company, source='test'
    )


class TestAuthentication:
    def test_anonymous_gets_401(self, api_client: Client) -> None:
        response = api_client.get('/api/search/people/')
        assert response.status_code == 401


class TestPeopleSearchResults:
    def test_result_row_shape(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        company = _company('SARL ÉLECTRICITÉ', wilaya=Wilaya.objects.get(code=31))
        _person('Mohamed Amine', role='GÉRANT', company=company)
        response = client.get('/api/search/people/')
        assert response.status_code == 200
        row = response.json()['results'][0]
        assert set(row.keys()) == {
            'id', 'name', 'role', 'company_name', 'wilaya_code', 'wilaya_name', 'revealed'
        }
        assert row['name'] == 'Mohamed Amine'
        assert row['role'] == 'GÉRANT'
        assert row['company_name'] == 'SARL ÉLECTRICITÉ'
        assert row['wilaya_code'] == 31
        assert row['revealed'] is False

    def test_wilaya_name_follows_user_locale(self, search_session: _Session) -> None:
        wilaya = Wilaya.objects.get(code=31)
        _person('Karim', company=_company('Alpha', wilaya=wilaya))
        for locale, expected in (
            ('ar', wilaya.name_ar),
            ('fr', wilaya.name_fr),
            ('en', wilaya.name_en),
        ):
            client, _ = search_session(locale)
            response = client.get('/api/search/people/')
            assert response.json()['results'][0]['wilaya_name'] == expected

    def test_person_without_company_has_null_fields(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('Solo', role='Directeur')
        row = client.get('/api/search/people/').json()['results'][0]
        assert row['company_name'] is None
        assert row['wilaya_code'] is None
        assert row['wilaya_name'] is None

    def test_empty_result_set(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        payload = client.get('/api/search/people/').json()
        assert payload['results'] == []
        assert payload['total'] == 0
        assert payload['truncated'] is False


class TestPeopleSearchFilters:
    def test_industry_filter(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        construction = _industry('Construction')
        pharma = _industry('Pharma')
        _person('A', company=_company('C1', industry=construction))
        _person('B', company=_company('C2', industry=construction))
        _person('C', company=_company('C3', industry=pharma))
        response = client.get(
            '/api/search/people/', {'filters': json.dumps({'industry': [construction.id]})}
        )
        names = {row['name'] for row in response.json()['results']}
        assert names == {'A', 'B'}

    def test_wilaya_filter(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        w31 = Wilaya.objects.get(code=31)
        w16 = Wilaya.objects.get(code=16)
        _person('A', company=_company('C1', wilaya=w31))
        _person('B', company=_company('C2', wilaya=w16))
        response = client.get('/api/search/people/', {'filters': json.dumps({'wilaya': [31]})})
        names = {row['name'] for row in response.json()['results']}
        assert names == {'A'}

    def test_seniority_filter(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('A', seniority='director')
        _person('B', seniority='manager')
        response = client.get(
            '/api/search/people/', {'filters': json.dumps({'seniority': ['director']})}
        )
        names = {row['name'] for row in response.json()['results']}
        assert names == {'A'}

    def test_keyword_ands_with_structured_filters(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        w31 = Wilaya.objects.get(code=31)
        w16 = Wilaya.objects.get(code=16)
        _person('Sofiane', company=_company('Alpha', wilaya=w31))
        _person('Sofiane', company=_company('Beta', wilaya=w16))
        response = client.get(
            '/api/search/people/',
            {'filters': json.dumps({'keyword': 'sofiane', 'wilaya': [31]})},
        )
        rows = response.json()['results']
        assert len(rows) == 1
        assert rows[0]['company_name'] == 'Alpha'

    def test_empty_keyword_returns_all(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('A')
        _person('B')
        unfiltered = client.get('/api/search/people/').json()['total']
        blank = client.get(
            '/api/search/people/', {'filters': json.dumps({'keyword': ''})}
        ).json()['total']
        assert unfiltered == 2
        assert blank == unfiltered

    def test_invalid_filter_returns_400_and_does_not_count(self, search_session: _Session) -> None:
        client, user = search_session('en')
        response = client.get('/api/search/people/', {'filters': 'not-json'})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_filters'
        assert DailyUsage.objects.filter(user_id=user.id).count() == 0


class TestPeopleSearchSorting:
    def test_sort_name_asc_and_desc(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('Karim')
        _person('Amine')
        _person('Zohra')
        asc = [
            row['name']
            for row in client.get('/api/search/people/', {'sort': 'name:asc'}).json()['results']
        ]
        desc = [
            row['name']
            for row in client.get('/api/search/people/', {'sort': 'name:desc'}).json()['results']
        ]
        assert asc == ['Amine', 'Karim', 'Zohra']
        assert desc == ['Zohra', 'Karim', 'Amine']

    def test_sort_company_name_nulls_last(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('Zoo Person', company=_company('Zeta'))
        _person('Solo Person')
        rows = client.get('/api/search/people/', {'sort': 'company_name:asc'}).json()['results']
        assert [row['name'] for row in rows] == ['Zoo Person', 'Solo Person']

    def test_sort_wilaya_code(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        w16 = Wilaya.objects.get(code=16)
        w31 = Wilaya.objects.get(code=31)
        _person('A', company=_company('C1', wilaya=w31))
        _person('B', company=_company('C2', wilaya=w16))
        rows = client.get('/api/search/people/', {'sort': 'wilaya_code:asc'}).json()['results']
        assert [row['wilaya_code'] for row in rows] == [16, 31]

    def test_sort_role(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('A', role='Directeur')
        _person('B', role='Gérant')
        rows = client.get('/api/search/people/', {'sort': 'role:asc'}).json()['results']
        assert [row['role'] for row in rows] == ['Directeur', 'Gérant']

    def test_invalid_sort_returns_400(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        response = client.get('/api/search/people/', {'sort': 'email:asc'})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_sort'


class TestPeopleSearchPagination:
    def test_100_rows_per_page(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        for index in range(105):
            _person(f'Person {index:03d}')
        page1 = client.get('/api/search/people/', {'page': '1'}).json()
        page2 = client.get('/api/search/people/', {'page': '2'}).json()
        assert len(page1['results']) == 100
        assert len(page2['results']) == 5
        assert page1['total'] == 105
        assert page1['truncated'] is False
        assert page2['page'] == 2

    def test_page_defaults_to_one(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('A')
        payload = client.get('/api/search/people/').json()
        assert payload['page'] == 1

    def test_invalid_page_returns_400(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        response = client.get('/api/search/people/', {'page': 'abc'})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_page'

    def test_page_beyond_1000_returns_400(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('A')
        response = client.get('/api/search/people/', {'page': '11'})
        assert response.status_code == 400
        assert response.json()['code'] == 'page_out_of_range'

    def test_page_10_is_served(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('A')
        response = client.get('/api/search/people/', {'page': '10'})
        assert response.status_code == 200


class TestPeopleSearchRateLimit:
    def test_successful_searches_increment_count(self, search_session: _Session) -> None:
        client, user = search_session('en')
        _person('A')
        for _ in range(3):
            client.get('/api/search/people/')
        assert DailyUsage.objects.get(user=user, date=timezone.localdate()).search_count == 3

    def test_429_at_free_limit_with_localized_message(self, search_session: _Session) -> None:
        client, user = search_session('fr')
        DailyUsage.objects.create(user=user, search_count=30)
        response = client.get('/api/search/people/')
        assert response.status_code == 429
        payload = response.json()
        assert payload['code'] == 'search_limit_exceeded'
        assert payload['limit'] == 30
        assert 'Vous' in payload['detail']
        assert DailyUsage.objects.get(user=user, date=timezone.localdate()).search_count == 30

    def test_429_starter_limit_is_100(self, search_session: _Session) -> None:
        client, user = search_session('en', tier='starter')
        DailyUsage.objects.create(user=user, search_count=100)
        response = client.get('/api/search/people/')
        assert response.status_code == 429
        assert response.json()['limit'] == 100

    def test_thirtieth_search_succeeds_then_429(self, search_session: _Session) -> None:
        client, user = search_session('en')
        DailyUsage.objects.create(user=user, search_count=29)
        assert client.get('/api/search/people/').status_code == 200
        assert client.get('/api/search/people/').status_code == 429
        assert DailyUsage.objects.get(user=user, date=timezone.localdate()).search_count == 30


class TestPeopleSearchNoNPlusOne:
    def test_page_request_is_query_bounded(
        self, search_session: _Session, django_assert_max_num_queries: Any
    ) -> None:
        client, _ = search_session('en')
        company = _company('SARL ÉLECTRICITÉ', wilaya=Wilaya.objects.get(code=31))
        for index in range(20):
            _person(f'Person {index:03d}', company=company)
        with django_assert_max_num_queries(10):
            response = client.get('/api/search/people/')
        assert len(response.json()['results']) == 20
