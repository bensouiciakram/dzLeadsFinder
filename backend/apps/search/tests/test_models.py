from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection
from django.utils import timezone

from apps.search.models import Company, DailyUsage, Industry, Person, SavedSearch, Wilaya

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema_user(create_user: object) -> object:
    return create_user


def _table_columns(table: str) -> dict[str, Any]:
    with connection.cursor() as cursor:
        description = connection.introspection.get_table_description(cursor, table)
    return {column.name: column for column in description}


class TestTablesExist:
    def test_all_six_tables_present(self) -> None:
        tables = connection.introspection.table_names()
        expected = ('companies', 'people', 'daily_usage', 'wilayas', 'industries', 'saved_searches')
        for table in expected:
            assert table in tables

    def test_table_names_match_spine(self) -> None:
        assert Company._meta.db_table == 'companies'
        assert Person._meta.db_table == 'people'
        assert DailyUsage._meta.db_table == 'daily_usage'
        assert Wilaya._meta.db_table == 'wilayas'
        assert Industry._meta.db_table == 'industries'
        assert SavedSearch._meta.db_table == 'saved_searches'


class TestPrimaryKeys:
    def test_company_pk_is_uuid(self) -> None:
        assert Company._meta.pk.get_internal_type() == 'UUIDField'

    def test_person_pk_is_uuid(self) -> None:
        assert Person._meta.pk.get_internal_type() == 'UUIDField'

    def test_wilaya_pk_is_smallint_code(self) -> None:
        assert Wilaya._meta.pk.name == 'code'
        assert Wilaya._meta.pk.get_internal_type() == 'SmallIntegerField'

    def test_industry_pk_is_serial_integer(self) -> None:
        assert Industry._meta.pk.name == 'id'
        assert Industry._meta.pk.get_internal_type() == 'AutoField'


class TestColumns:
    def test_companies_columns(self) -> None:
        columns = _table_columns('companies')
        expected = {
            'id', 'name', 'industry_id', 'wilaya_code', 'size_band',
            'website', 'source', 'last_verified_at', 'created_at',
            'search_normalized',
        }
        assert expected.issubset(columns)

    def test_people_columns(self) -> None:
        columns = _table_columns('people')
        expected = {
            'id', 'company_id', 'name', 'role', 'seniority', 'email',
            'phone', 'address', 'source', 'last_verified_at', 'created_at',
            'search_normalized',
        }
        assert expected.issubset(columns)

    def test_daily_usage_columns(self) -> None:
        columns = _table_columns('daily_usage')
        expected = {'id', 'user_id', 'date', 'search_count', 'export_rows'}
        assert expected.issubset(columns)

    def test_wilayas_columns(self) -> None:
        columns = _table_columns('wilayas')
        expected = {'code', 'name_ar', 'name_fr', 'name_en'}
        assert expected.issubset(columns)

    def test_industries_columns(self) -> None:
        columns = _table_columns('industries')
        expected = {'id', 'name_ar', 'name_fr', 'name_en', 'is_active'}
        assert expected.issubset(columns)


class TestNullability:
    def test_companies_required_columns(self) -> None:
        columns = _table_columns('companies')
        assert columns['name'].null_ok is False
        assert columns['source'].null_ok is False
        assert columns['size_band'].null_ok is True
        assert columns['website'].null_ok is True
        assert columns['industry_id'].null_ok is True
        assert columns['wilaya_code'].null_ok is True

    def test_people_required_columns(self) -> None:
        columns = _table_columns('people')
        assert columns['name'].null_ok is False
        assert columns['source'].null_ok is False
        assert columns['role'].null_ok is True
        assert columns['company_id'].null_ok is True

    def test_daily_usage_date_required(self) -> None:
        columns = _table_columns('daily_usage')
        assert columns['date'].null_ok is False

    def test_wilayas_names_required(self) -> None:
        columns = _table_columns('wilayas')
        assert columns['name_ar'].null_ok is False
        assert columns['name_fr'].null_ok is False
        assert columns['name_en'].null_ok is False


class TestForeignKeys:
    def test_company_industry_fk(self) -> None:
        field = Company._meta.get_field('industry')
        assert field.remote_field.model is Industry
        assert field.column == 'industry_id'
        assert field.target_field.get_internal_type() == 'AutoField'

    def test_company_wilaya_fk(self) -> None:
        field = Company._meta.get_field('wilaya_code')
        assert field.remote_field.model is Wilaya
        assert field.column == 'wilaya_code'
        assert field.target_field.get_internal_type() == 'SmallIntegerField'

    def test_person_company_fk(self) -> None:
        field = Person._meta.get_field('company')
        assert field.remote_field.model is Company
        assert field.column == 'company_id'
        assert field.target_field.get_internal_type() == 'UUIDField'

    def test_daily_usage_user_fk_targets_bigint(self) -> None:
        field = DailyUsage._meta.get_field('user')
        assert field.remote_field.model is User
        assert field.target_field.get_internal_type() == 'BigAutoField'

    def test_company_industry_delete_sets_null(self) -> None:
        industry = Industry.objects.create(name_ar='أ', name_fr='a', name_en='a')
        company = Company.objects.create(name='SARL Test', source='scraper', industry=industry)
        industry.delete()
        company.refresh_from_db()
        assert company.industry_id is None

    def test_company_wilaya_delete_sets_null(self) -> None:
        wilaya, _ = Wilaya.objects.get_or_create(
            code=1,
            defaults={'name_ar': 'أدرار', 'name_fr': 'Adrar', 'name_en': 'Adrar'},
        )
        company = Company.objects.create(name='SARL Test', source='scraper', wilaya_code=wilaya)
        wilaya.delete()
        company.refresh_from_db()
        assert company.wilaya_code_id is None

    def test_person_company_delete_sets_null(self) -> None:
        company = Company.objects.create(name='SARL Test', source='scraper')
        person = Person.objects.create(name='Ahmed', company=company, source='scraper')
        company.delete()
        person.refresh_from_db()
        assert person.company_id is None

    def test_daily_usage_user_delete_cascades(self, schema_user: object) -> None:
        usage = DailyUsage.objects.create(user=schema_user)
        user = User.objects.get(pk=usage.user_id)
        user.delete()
        assert DailyUsage.objects.filter(pk=usage.pk).count() == 0


class TestNotNullConstraints:
    def test_company_name_required(self) -> None:
        with pytest.raises(IntegrityError):
            Company.objects.create(name=None, source='scraper')

    def test_company_source_required(self) -> None:
        with pytest.raises(IntegrityError):
            Company.objects.create(name='SARL Test', source=None)

    def test_person_name_required(self) -> None:
        with pytest.raises(IntegrityError):
            Person.objects.create(name=None, source='scraper')

    def test_industry_name_en_unique_enforced(self) -> None:
        Industry.objects.create(name_ar='أ', name_fr='a', name_en='Unique Name')
        with pytest.raises(IntegrityError):
            Industry.objects.create(name_ar='ب', name_fr='b', name_en='Unique Name')

    def test_wilaya_code_range_enforced(self) -> None:
        with pytest.raises(IntegrityError):
            Wilaya.objects.create(code=99, name_ar='أ', name_fr='a', name_en='a')


class TestDailyUsageUniquePerDay:
    def test_second_row_same_user_same_date_rejected(self, schema_user: object) -> None:
        today = timezone.localdate()
        DailyUsage.objects.create(user=schema_user, date=today)
        with pytest.raises(IntegrityError):
            DailyUsage.objects.create(user=schema_user, date=today)

    def test_same_user_different_dates_allowed(self, schema_user: object) -> None:
        today = timezone.localdate()
        DailyUsage.objects.create(user=schema_user, date=today)
        DailyUsage.objects.create(user=schema_user, date=today - timezone.timedelta(days=1))
        assert DailyUsage.objects.filter(user=schema_user).count() == 2


class TestSearchNormalizedOnSave:
    def test_company_normalized_on_save(self) -> None:
        company = Company.objects.create(name='SARL ÉLECTRICITÉ', source='scraper')
        assert company.search_normalized == 'sarl electricite'

    def test_company_normalized_updated_on_resave(self) -> None:
        company = Company.objects.create(name='SARL Test', source='scraper')
        company.name = 'BÂTIMENT ALGER'
        company.save()
        company.refresh_from_db()
        assert company.search_normalized == 'batiment alger'

    def test_company_normalized_survives_update_fields(self) -> None:
        company = Company.objects.create(name='SARL Test', source='scraper')
        Company.objects.filter(pk=company.pk).update(name='ÉNERGIE NOUVELLE')
        company.name = 'ÉNERGIE NOUVELLE'
        company.save(update_fields=['name'])
        company.refresh_from_db()
        assert company.name == 'ÉNERGIE NOUVELLE'
        assert company.search_normalized == 'energie nouvelle'

    def test_person_normalized_survives_role_update_fields(self) -> None:
        person = Person.objects.create(name='Ahmed', role='Gérant', source='scraper')
        person.role = 'DIRECTEUR'
        person.save(update_fields=['role'])
        person.refresh_from_db()
        assert person.search_normalized == 'ahmed directeur'

    def test_person_normalized_name_and_role(self) -> None:
        person = Person.objects.create(name='محمد أمين', role='GÉRANT', source='scraper')
        assert person.search_normalized == 'محمد امين gerant'

    def test_person_without_role_normalized(self) -> None:
        person = Person.objects.create(name='GÉRANT', source='scraper')
        assert person.search_normalized == 'gerant'
