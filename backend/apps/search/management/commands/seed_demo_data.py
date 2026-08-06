"""Seed realistic demo people and companies for local development.

The scraper pipeline (Epic 6) is the production data source; this command gives
developers searchable data without it. Rows are written via ``bulk_create`` with
``search_normalized`` set EXPLICITLY (the models' ``save()`` hook is skipped by
bulk writes — see the search-app deferred-work note) so the tsvector-backed
keyword path works immediately.
"""

from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from apps.search import search_index
from apps.search.filters import SENIORITY_BANDS, SIZE_BANDS
from apps.search.models import Company, Industry, Person, Wilaya

COMPANY_NAMES_FR = [
    'SARL ÉLECTRICITÉ BENAISSA',
    'ETS HADJ ALI',
    'BTP KACI FRÈRES',
    'SARL TRANSPORT AMARA',
    'AGROALIMENTAIRE DJERBAOUI',
    'SOCIÉTÉ DE TEXTILE ORAN',
    'IMMOBILIER MEDITERRANÉE',
    'SARL INFORMATIQUE EL DJAZAIR',
    'CONSTRUCTIONS BOUZID',
    'PLASTIQUE ET EMBALLAGE SETIF',
    'SARL COMMERCE GÉNÉRAL AIT AHMED',
    'HYDRAULIQUE SUD ALGÉRIE',
    'SARL BOIS ET DÉRIVÉS',
    'MÉCANIQUE INDUSTRIELLE BEJAIA',
    'TRANSPORTS ROUTIERS M\u2019ZAB',
    'SARL SANTÉ CONSTANTINE',
    'AGROBUSINESS HAUTS PLATEAUX',
    'SARL BÂTIMENT MODERNE',
    'PÊCHE ET AQUACULTURE ANNABA',
    'SARL ÉNERGIE RENOUVELABLE SAHARA',
]

COMPANY_NAMES_AR = [
    'شركة النقل الأمين',
    'مؤسسة البناء الحديثة',
    'مصنع النسيج الجزائري',
    'شركة الإتصالات والتكنولوجيا',
    'مؤسسة الخدمات الفلاحية',
    'شركة الصناعات الغذائية',
    'مؤسسة الأشغال العمومية',
    'شركة العقارات والإسكان',
    'مصنع الإسمنت الأخضر',
    'شركة التوزيع واللوجستيك',
]

COMPANY_SUFFIXES = ['SARL', 'SPA', 'ETS', 'BTP', 'GROUPE']

STREETS_FR = [
    'Rue Didouche Mourad',
    'Cité 5 Juillet',
    'Zone industrielle',
    'Route nationale 5',
    'Boulevard de la Révolution',
    'Haï Ben Aknoun',
    'Zone d\'activité',
    'Rue des Frères Bouadou',
]

PERSON_FIRST_FR = [
    'Mohamed', 'Amina', 'Karim', 'Yasmine', 'Sofiane', 'Nadia', 'Rachid', 'Lina',
    'Amine', 'Fatima', 'Hichem', 'Salima', 'Walid', 'Imane', 'Bilal', 'Meriem',
]

PERSON_LAST_FR = [
    'Benali', 'Khelifi', 'Bouzid', 'Amrani', 'Saidi', 'Mansouri', 'Cherif',
    'Haddad', 'Belkacem', 'Meziane', 'Toumi', 'Guerroudj', 'Bensaid', 'Ouali',
]

PERSON_FIRST_AR = [
    'أمين', 'أمينة', 'كريم', 'ياسمين', 'سفيان', 'نادية', 'رشيد', 'لينة',
]

PERSON_LAST_AR = [
    'بن علي', 'خليفي', 'بوزيد', 'عمراني', 'سعيدي', 'منصوري', 'شريف', 'حمداد',
]

ROLES_FR = [
    'Gérant', 'Directeur général', 'Directrice commerciale', 'Chef de projet',
    'Responsable des achats', 'Comptable', 'Ingénieur d\'études', 'Technicien',
    'Responsable marketing', 'Chef d\'atelier', 'Acheteur', 'Agent commercial',
]

ROLES_AR = [
    'مدير', 'مدير عام', 'مديرة تجارية', 'رئيس مشروع', 'محاسب', 'مهندس دراسات',
    'فني', 'مسؤول المشتريات', 'مدير تسويق', 'وكيل تجاري',
]

PHONE_PREFIXES = ['05', '06', '07']


class Command(BaseCommand):
    help = (
        'Seed demo people and companies for local development. '
        'Refuses to run when people/companies already exist unless --force is given.'
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            '--force', action='store_true', help='Delete existing people/companies and reseed.'
        )
        parser.add_argument(
            '--companies',
            type=int,
            default=120,
            help='Number of companies to create (default 120).',
        )
        parser.add_argument(
            '--people',
            type=int,
            default=280,
            help='Number of people to create (default 280).',
        )

    def handle(self, *args: Any, **options: Any) -> str | None:
        force: bool = options['force']
        companies_count: int = options['companies']
        people_count: int = options['people']

        if Company.objects.exists() or Person.objects.exists():
            if not force:
                raise CommandError(
                    'People/companies already exist. Use --force to delete and reseed.'
                )
            Person.objects.all().delete()
            Company.objects.all().delete()

        industries = list(Industry.objects.order_by('id'))
        wilayas = list(Wilaya.objects.order_by('code'))
        if not industries or not wilayas:
            raise CommandError(
                'No industries/wilayas found — run the search migrations first '
                '(0003 wilaya seed, 0004 industry seed).'
            )

        now = timezone.now()
        companies: list[Company] = []
        for index in range(companies_count):
            if index % 2 == 0:
                base = COMPANY_NAMES_FR[index % len(COMPANY_NAMES_FR)]
            else:
                base = COMPANY_NAMES_AR[index % len(COMPANY_NAMES_AR)]
            name = f'{base} {COMPANY_SUFFIXES[(index // 2) % len(COMPANY_SUFFIXES)]}'
            wilaya = wilayas[(index * 7) % len(wilayas)]
            companies.append(
                Company(
                    name=name,
                    industry=industries[index % len(industries)],
                    wilaya_code=wilaya,
                    size_band=SIZE_BANDS[index % len(SIZE_BANDS)],
                    website=f'https://www.example-{index + 1}.dz' if index % 3 == 0 else None,
                    source='demo',
                    last_verified_at=now - timedelta(days=index % 30),
                    search_normalized=search_index.normalize_search(name),
                )
            )
        Company.objects.bulk_create(companies, batch_size=500)

        companies_with_people = companies[: max(1, int(len(companies) * 0.85))]
        people: list[Person] = []
        for index in range(people_count):
            arabic = index % 4 == 0
            if arabic:
                first = PERSON_FIRST_AR[index % len(PERSON_FIRST_AR)]
                last = PERSON_LAST_AR[(index // len(PERSON_FIRST_AR)) % len(PERSON_LAST_AR)]
                role = ROLES_AR[index % len(ROLES_AR)]
            else:
                first = PERSON_FIRST_FR[index % len(PERSON_FIRST_FR)]
                last = PERSON_LAST_FR[(index // len(PERSON_FIRST_FR)) % len(PERSON_LAST_FR)]
                role = ROLES_FR[index % len(ROLES_FR)]
            name = f'{first} {last}'
            company = (
                companies_with_people[index % len(companies_with_people)]
                if index % 5 != 0
                else None
            )
            wilaya = company.wilaya_code if company is not None else wilayas[index % len(wilayas)]
            prefix = PHONE_PREFIXES[index % len(PHONE_PREFIXES)]
            second = 60 + (index % 39)
            third = 10 + (index % 89)
            fourth = index % 100
            fifth = 10 + (index * 3) % 90
            phone = f'{prefix} {second:02d} {third:02d} {fourth:02d} {fifth:02d}'
            people.append(
                Person(
                    company=company,
                    name=name,
                    role=role,
                    seniority=SENIORITY_BANDS[index % len(SENIORITY_BANDS)],
                    email=f'contact.{index + 1}@example.dz',
                    phone=phone,
                    address=f'{STREETS_FR[index % len(STREETS_FR)]}, {wilaya.name_fr}',
                    source='demo',
                    last_verified_at=now - timedelta(days=index % 30),
                    search_normalized=search_index.normalize_search(name, role or ''),
                )
            )
        Person.objects.bulk_create(people, batch_size=500)

        self.stdout.write(
            self.style.SUCCESS(
                f'Seeded {companies_count} companies and {people_count} people '
                f'({len(companies_with_people)} companies with contacts).'
            )
        )
        return None
