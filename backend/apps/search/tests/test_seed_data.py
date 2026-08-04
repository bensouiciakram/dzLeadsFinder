import importlib
import inspect

import pytest
from django.apps import apps as django_apps
from django.db import migrations

from apps.search.data.industries import INDUSTRIES
from apps.search.data.wilayas import WILAYAS
from apps.search.models import Industry, Wilaya

pytestmark = pytest.mark.django_db


class TestWilayaSeed:
    def test_exactly_58_rows(self) -> None:
        assert Wilaya.objects.count() == 58

    def test_codes_cover_1_to_58(self) -> None:
        codes = set(Wilaya.objects.values_list('code', flat=True))
        assert codes == set(range(1, 59))

    def test_no_blank_names(self) -> None:
        assert not Wilaya.objects.filter(name_ar='').exists()
        assert not Wilaya.objects.filter(name_fr='').exists()
        assert not Wilaya.objects.filter(name_en='').exists()

    def test_data_module_58_contiguous_rows(self) -> None:
        assert len(WILAYAS) == 58
        assert [row['code'] for row in WILAYAS] == list(range(1, 59))
        assert all(row['name_ar'] and row['name_fr'] and row['name_en'] for row in WILAYAS)

    def test_data_module_unique_codes(self) -> None:
        codes = [row['code'] for row in WILAYAS]
        assert len(codes) == len(set(codes))

    def test_seed_migration_exists(self) -> None:
        module = importlib.import_module('apps.search.migrations.0003_wilaya_seed')
        assert issubclass(module.Migration, migrations.Migration)
        source = inspect.getsource(module)
        assert 'migrations.RunPython' in source
        assert 'bulk_create' in source
        assert 'ignore_conflicts=True' in source
        assert "get_model('search', 'Wilaya')" in source

    def test_spot_check_canonical_rows(self) -> None:
        assert (Wilaya.objects.get(code=16).name_en, Wilaya.objects.get(code=16).name_ar) == (
            'Algiers',
            'الجزائر',
        )
        assert (Wilaya.objects.get(code=31).name_fr, Wilaya.objects.get(code=31).name_en) == (
            'Oran',
            'Oran',
        )
        assert (Wilaya.objects.get(code=58).name_ar, Wilaya.objects.get(code=58).name_fr) == (
            'المنيعة',
            'El Menia',
        )


class TestIndustrySeed:
    def test_at_least_30_rows(self) -> None:
        assert Industry.objects.count() >= 30

    def test_all_active(self) -> None:
        assert not Industry.objects.filter(is_active=False).exists()

    def test_no_blank_names(self) -> None:
        assert not Industry.objects.filter(name_ar='').exists()
        assert not Industry.objects.filter(name_fr='').exists()
        assert not Industry.objects.filter(name_en='').exists()

    def test_name_en_unique(self) -> None:
        names = Industry.objects.values_list('name_en', flat=True)
        assert len(list(names)) == len(set(names))

    def test_data_module_at_least_30(self) -> None:
        assert len(INDUSTRIES) >= 30
        assert all(row['name_ar'] and row['name_fr'] and row['name_en'] for row in INDUSTRIES)

    def test_prd_anchor_industries_present(self) -> None:
        names = Industry.objects.values_list('name_en', flat=True)
        anchors = (
            'Construction',
            'Agroalimentaire',
            'Pharmaceuticals',
            'Advertising',
            'Telecom Distribution',
        )
        for anchor in anchors:
            assert anchor in list(names)

    def test_seed_migration_exists(self) -> None:
        module = importlib.import_module('apps.search.migrations.0004_industry_seed')
        assert issubclass(module.Migration, migrations.Migration)
        source = inspect.getsource(module)
        assert 'migrations.RunPython' in source
        assert 'bulk_create' in source
        assert 'ignore_conflicts=True' in source
        assert "get_model('search', 'Industry')" in source


class TestSeedMigrationBehavior:
    def test_wilaya_seed_idempotent_and_reversible(self) -> None:
        module = importlib.import_module('apps.search.migrations.0003_wilaya_seed')
        module.seed_wilayas(django_apps, None)
        assert Wilaya.objects.count() == 58
        module.unseed_wilayas(django_apps, None)
        assert Wilaya.objects.count() == 0
        module.seed_wilayas(django_apps, None)
        assert Wilaya.objects.count() == 58

    def test_industry_seed_idempotent_and_reversible(self) -> None:
        module = importlib.import_module('apps.search.migrations.0004_industry_seed')
        module.seed_industries(django_apps, None)
        assert Industry.objects.count() >= 30
        module.unseed_industries(django_apps, None)
        assert Industry.objects.count() == 0
        module.seed_industries(django_apps, None)
        assert Industry.objects.count() == len(INDUSTRIES)
