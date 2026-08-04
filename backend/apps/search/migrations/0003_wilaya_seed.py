from typing import Any

from django.db import migrations

from apps.search.data.wilayas import WILAYAS


def seed_wilayas(apps: Any, schema_editor: Any) -> None:
    Wilaya = apps.get_model('search', 'Wilaya')
    Wilaya.objects.bulk_create([Wilaya(**row) for row in WILAYAS], ignore_conflicts=True)


def unseed_wilayas(apps: Any, schema_editor: Any) -> None:
    Wilaya = apps.get_model('search', 'Wilaya')
    Wilaya.objects.filter(code__in=[row['code'] for row in WILAYAS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('search', '0002_search_pg_tsvector'),
    ]

    operations = [
        migrations.RunPython(seed_wilayas, unseed_wilayas),
    ]
