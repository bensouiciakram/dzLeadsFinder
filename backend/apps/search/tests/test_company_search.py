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


def _person(name: str, *, role: str | None = None, company: Any = None) -> Any:
    return Person.objects.create(name=name, role=role, company=company, source='test')


class TestAuthentication:
    def test_anonymous_gets_401(self, api_client: Client) -> None:
        assert api_client.get('/api/search/companies/').status_code == 401


class TestCompanySearchResults:
    def test_result_row_shape(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        industry = _industry('Construction')
        _company('SARL ÉLECTRICITÉ', industry=industry, wilaya=Wilaya.objects.get(code=31))
        response = client.get('/api/search/companies/')
        assert response.status_code == 200
        row = response.json()['results'][0]
        assert set(row.keys()) == {
            'id', 'name', 'industry', 'industry_id', 'wilaya_code', 'wilaya_name', 'size_band',
            'people_count',
        }
        assert row['name'] == 'SARL ÉLECTRICITÉ'
        assert row['industry_id'] == industry.id
        assert row['wilaya_code'] == 31
        assert row['size_band'] is None
        assert row['people_count'] == 0

    def test_industry_localized_per_locale(self, search_session: _Session) -> None:
        industry = Industry.objects.create(
            name_ar='بناء', name_fr='Construction', name_en='Building'
        )
        _company('C1', industry=industry)
        for locale, expected in (('ar', 'بناء'), ('fr', 'Construction'), ('en', 'Building')):
            client, _ = search_session(locale)
            row = client.get('/api/search/companies/').json()['results'][0]
            assert row['industry'] == expected

    def test_wilaya_name_follows_user_locale(self, search_session: _Session) -> None:
        wilaya = Wilaya.objects.get(code=16)
        _company('C1', wilaya=wilaya)
        for locale, expected in (
            ('ar', wilaya.name_ar),
            ('fr', wilaya.name_fr),
            ('en', wilaya.name_en),
        ):
            client, _ = search_session(locale)
            row = client.get('/api/search/companies/').json()['results'][0]
            assert row['wilaya_name'] == expected

    def test_people_count_zero_and_multiple(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        empty = _company('No People Co')
        full = _company('Full Co')
        _person('A', company=full)
        _person('B', company=full)
        rows = {
            row['name']: row['people_count']
            for row in client.get('/api/search/companies/').json()['results']
        }
        assert rows[empty.name] == 0
        assert rows[full.name] == 2


class TestCompanySearchFilters:
    def test_industry_filter(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        construction = _industry('Construction')
        pharma = _industry('Pharma')
        _company('C1', industry=construction)
        _company('C2', industry=pharma)
        response = client.get(
            '/api/search/companies/', {'filters': json.dumps({'industry': [construction.id]})}
        )
        names = {row['name'] for row in response.json()['results']}
        assert names == {'C1'}

    def test_wilaya_filter(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        w31 = Wilaya.objects.get(code=31)
        w16 = Wilaya.objects.get(code=16)
        _company('C1', wilaya=w31)
        _company('C2', wilaya=w16)
        response = client.get('/api/search/companies/', {'filters': json.dumps({'wilaya': [31]})})
        names = {row['name'] for row in response.json()['results']}
        assert names == {'C1'}

    def test_size_filter_excludes_unknown(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _company('C1', size_band='11-50')
        _company('C2', size_band=None)
        response = client.get(
            '/api/search/companies/', {'filters': json.dumps({'size': ['11-50']})}
        )
        names = {row['name'] for row in response.json()['results']}
        assert names == {'C1'}

    def test_include_unknown_size_adds_unknowns(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _company('C1', size_band='11-50')
        _company('C2', size_band=None)
        response = client.get(
            '/api/search/companies/',
            {'filters': json.dumps({'size': ['11-50'], 'include_unknown_size': True})},
        )
        names = {row['name'] for row in response.json()['results']}
        assert names == {'C1', 'C2'}

    def test_include_unknown_size_without_size_is_no_op(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _company('C1', size_band='11-50')
        _company('C2', size_band=None)
        with_unknown = client.get(
            '/api/search/companies/',
            {'filters': json.dumps({'include_unknown_size': True})},
        ).json()['total']
        without = client.get('/api/search/companies/').json()['total']
        assert with_unknown == without == 2

    def test_keyword_matches_company_name_only(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _company('SARL ÉLECTRICITÉ')
        _company('BÂTIMENT BTP')
        _person('Gérant Test', role='Gérant', company=_company('Autre'))
        response = client.get(
            '/api/search/companies/', {'filters': json.dumps({'keyword': 'gerant'})}
        )
        names = {row['name'] for row in response.json()['results']}
        assert names == set()
        response = client.get(
            '/api/search/companies/', {'filters': json.dumps({'keyword': 'électricité'})}
        )
        names = {row['name'] for row in response.json()['results']}
        assert names == {'SARL ÉLECTRICITÉ'}


class TestCompanySearchSorting:
    def test_sort_name_asc_and_desc(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _company('Karim Co')
        _company('Amine Co')
        _company('Zohra Co')
        asc = [
            row['name']
            for row in client.get('/api/search/companies/', {'sort': 'name:asc'}).json()['results']
        ]
        desc = [
            row['name']
            for row in client.get('/api/search/companies/', {'sort': 'name:desc'}).json()['results']
        ]
        assert asc == ['Amine Co', 'Karim Co', 'Zohra Co']
        assert desc == ['Zohra Co', 'Karim Co', 'Amine Co']

    def test_sort_by_people_count(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        empty = _company('Empty Co')
        two = _company('Two Co')
        _person('A', company=two)
        _person('B', company=two)
        rows = client.get('/api/search/companies/', {'sort': 'people_count:desc'}).json()['results']
        assert [row['name'] for row in rows] == [two.name, empty.name]

    def test_sort_by_size_band_and_wilaya_code(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        w16 = Wilaya.objects.get(code=16)
        w31 = Wilaya.objects.get(code=31)
        _company('C1', size_band='500+', wilaya=w31)
        _company('C2', size_band='1-10', wilaya=w16)
        by_size = [
            row['name']
            for row in client.get(
                '/api/search/companies/', {'sort': 'size_band:asc'}
            ).json()['results']
        ]
        by_wilaya = [
            row['name']
            for row in client.get(
                '/api/search/companies/', {'sort': 'wilaya_code:asc'}
            ).json()['results']
        ]
        assert by_size == ['C2', 'C1']
        assert by_wilaya == ['C2', 'C1']

    def test_size_band_sort_follows_band_order_not_lexicographic(
        self, search_session: _Session
    ) -> None:
        client, _ = search_session('en')
        _company('A', size_band='500+')
        _company('B', size_band='51-200')
        _company('C', size_band='1-10')
        _company('D', size_band=None)
        asc = [
            row['name']
            for row in client.get(
                '/api/search/companies/', {'sort': 'size_band:asc'}
            ).json()['results']
        ]
        desc = [
            row['name']
            for row in client.get(
                '/api/search/companies/', {'sort': 'size_band:desc'}
            ).json()['results']
        ]
        assert asc == ['C', 'B', 'A', 'D']
        assert desc == ['A', 'B', 'C', 'D']


    def test_sort_by_industry(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        alpha = Industry.objects.create(
            name_ar='ألفا', name_fr='Alpha', name_en='Alpha'
        )
        gamma = Industry.objects.create(
            name_ar='غاما', name_fr='Gamma', name_en='Gamma'
        )
        beta = Industry.objects.create(
            name_ar='بيتا', name_fr='Beta', name_en='Beta'
        )
        no_industry = _company('No Industry Co', industry=None)
        _company('A Co', industry=alpha)
        _company('G Co', industry=gamma)
        _company('B Co', industry=beta)
        asc = [
            row['name']
            for row in client.get(
                '/api/search/companies/', {'sort': 'industry:asc'}
            ).json()['results']
        ]
        desc = [
            row['name']
            for row in client.get(
                '/api/search/companies/', {'sort': 'industry:desc'}
            ).json()['results']
        ]
        assert asc == ['A Co', 'B Co', 'G Co', no_industry.name]
        assert desc == ['G Co', 'B Co', 'A Co', no_industry.name]

    def test_industry_sort_rejected_on_people(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        _person('A')
        response = client.get('/api/search/people/', {'sort': 'industry:asc'})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_sort'

    def test_sort_ties_break_by_id_for_stable_pagination(self, search_session: _Session) -> None:
        client, _ = search_session('en')
        industry = Industry.objects.create(
            name_ar='ألفا', name_fr='Alpha', name_en='Alpha'
        )
        first = _company('Same Name Co', industry=industry)
        second = _company('Same Name Co', industry=industry)
        first_run = client.get(
            '/api/search/companies/', {'sort': 'industry:asc'}
        ).json()['results']
        second_run = client.get(
            '/api/search/companies/', {'sort': 'industry:asc'}
        ).json()['results']
        first_ids = [row['id'] for row in first_run]
        assert first_ids == [row['id'] for row in second_run]
        assert set(first_ids) == {str(first.id), str(second.id)}


class TestCompanySearchRateLimit:
    def test_people_and_company_searches_share_daily_usage(self, search_session: _Session) -> None:
        client, user = search_session('en')
        _person('A')
        _company('C1')
        client.get('/api/search/people/')
        client.get('/api/search/people/')
        client.get('/api/search/companies/')
        assert DailyUsage.objects.filter(user=user, date=timezone.localdate()).count() == 1
        assert DailyUsage.objects.get(user=user, date=timezone.localdate()).search_count == 3

    def test_company_searches_count_toward_same_limit(self, search_session: _Session) -> None:
        client, user = search_session('en')
        _company('C1')
        DailyUsage.objects.create(user=user, search_count=29)
        assert client.get('/api/search/companies/').status_code == 200
        assert client.get('/api/search/companies/').status_code == 429
        assert DailyUsage.objects.get(user=user, date=timezone.localdate()).search_count == 30

    def test_429_at_limit_with_company_fields(self, search_session: _Session) -> None:
        client, user = search_session('en', tier='starter')
        DailyUsage.objects.create(user=user, search_count=100)
        response = client.get('/api/search/companies/')
        assert response.status_code == 429
        assert response.json()['code'] == 'search_limit_exceeded'
        assert response.json()['limit'] == 100
