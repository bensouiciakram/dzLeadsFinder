from typing import Any

from django.db import migrations

from apps.search.data.industries import INDUSTRIES


def seed_industries(apps: Any, schema_editor: Any) -> None:
    Industry = apps.get_model('search', 'Industry')
    rows = [
        Industry(name_ar=row['name_ar'], name_fr=row['name_fr'], name_en=row['name_en'], is_active=True)
        for row in INDUSTRIES
    ]
    Industry.objects.bulk_create(rows, ignore_conflicts=True)


def unseed_industries(apps: Any, schema_editor: Any) -> None:
    Industry = apps.get_model('search', 'Industry')
    Industry.objects.filter(name_en__in=[row['name_en'] for row in INDUSTRIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('search', '0003_wilaya_seed'),
    ]

    operations = [
        migrations.RunPython(seed_industries, unseed_industries),
    ]
