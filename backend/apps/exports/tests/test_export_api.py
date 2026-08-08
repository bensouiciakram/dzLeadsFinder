"""Export API endpoint tests: POST /api/export/ + GET /api/export/{id}/download/.

Covers the AC contract: atomic N-row debit, rate limit (5,000 rows/24h),
tier gating (paid-only in 4.4), strict payload validation, ownership-filtered
downloads with the exact MIME/disposition contract, and the auth-layer
policy for anonymous/frozen users.
"""

import uuid
from typing import Any, Callable, cast

import pytest
from django.contrib.auth import get_user_model
from django.db.models import F, Sum
from django.test import Client
from django.utils import timezone

from apps.credits.models import CreditEventType, CreditLedger, Reveal
from apps.exports.messages import EXPORT_LIMIT_MESSAGES
from apps.exports.models import Export
from apps.search.models import Company, DailyUsage, Person

User = get_user_model()

_Session = Callable[..., tuple[Client, Any]]

pytestmark = pytest.mark.django_db

VALID_PAYLOAD: dict[str, object] = {
    'record_ids': [],
    'format': 'csv',
    'include_unrevealed': True,
}


@pytest.fixture
def person() -> Person:
    company = Company.objects.create(
        name='ACME Algérie', website='https://acme.dz', source='seed'
    )
    return cast(
        Person,
        Person.objects.create(
            name='Karim Benali',
            role='CEO',
            email='karim@acme.dz',
            phone='0550 12 34 56',
            address='Alger Centre, Alger',
            company=company,
            source='seed',
        ),
    )


@pytest.fixture
def company() -> Company:
    return cast(
        Company,
        Company.objects.create(name='ACME Algérie', website='https://acme.dz', source='seed'),
    )


@pytest.fixture
def export_session() -> _Session:
    def _login(
        locale: str = 'en', tier: str = 'starter', verified: bool = True
    ) -> tuple[Client, Any]:
        # A FRESH client per login: the module-level api_client cookie jar
        # would be overwritten by the second login (the 4.1 cross-user
        # lesson) — every session must act as exactly its own identity.
        client = Client()
        email = f'{uuid.uuid4().hex}@example.com'
        user = User.objects.create_user(
            email=email, password='SecurePass123!', locale=locale, tier=tier
        )
        if verified:
            user.email_verified_at = timezone.now()
            user.save(update_fields=['email_verified_at'])
        client.post('/api/auth/login/', {'email': email, 'password': 'SecurePass123!'})
        return client, user

    return _login


@pytest.fixture
def grant() -> Callable[..., Any]:
    def _grant(user: Any, amount: int, pool: str = 'subscription') -> Any:
        total = (
            CreditLedger.objects.filter(user=user).aggregate(total=Sum('amount'))['total'] or 0
        )
        CreditLedger.objects.create(
            user=user,
            event_type=CreditEventType.PROMOTIONAL_GRANT,
            amount=amount,
            balance_after=total + amount,
            pool=pool,
        )
        User.objects.filter(pk=user.pk).update(credits_balance=F('credits_balance') + amount)
        user.refresh_from_db()
        return user

    return _grant


@pytest.fixture
def reveal() -> Callable[..., Any]:
    def _reveal(user: Any, record_type: str, record_id: str) -> Any:
        return Reveal.objects.create(
            user=user, record_type=record_type, record_id=str(record_id)
        )

    return _reveal


@pytest.fixture
def seed_usage() -> Callable[..., Any]:
    def _seed(user: Any, rows: int) -> Any:
        usage, _ = DailyUsage.objects.get_or_create(
            user=user, date=timezone.localdate()
        )
        DailyUsage.objects.filter(pk=usage.pk).update(export_rows=rows)
        return usage

    return _seed


def _post(client: Client, payload: dict[str, object]) -> Any:
    return client.post('/api/export/', payload, content_type='application/json')


class TestAuth:
    def test_anonymous_rejected(self, api_client: Client) -> None:
        response = _post(api_client, VALID_PAYLOAD)
        assert response.status_code == 401

    def test_frozen_user_rejected_by_auth_policy(
        self, export_session: _Session, person: Person
    ) -> None:
        client, user = export_session()
        user.deleted_at = timezone.now()
        user.save(update_fields=['deleted_at'])
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 401
        assert response.json()['code'] == 'account_deleted'


class TestTierGate:
    def test_free_user_csv_export_succeeds_with_watermark(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
    ) -> None:
        """4.6: the D8 split lands — free+csv is REAL (5-row cap + watermark),
        no longer the 4.4 paid-only 403."""
        client, user = export_session(tier='free')
        grant(user, 15)
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert set(body) == {
            'id',
            'format',
            'row_count',
            'revealed_count',
            'unrevealed_count',
            'credits_cost',
            'included_unrevealed',
            'watermark',
            'created_at',
            'balances',
        }
        assert body['format'] == 'csv'
        assert body['row_count'] == 1
        assert body['revealed_count'] + body['unrevealed_count'] == 1
        assert body['credits_cost'] == 1
        assert body['watermark'] is True
        export_row = Export.objects.get(user=user)
        assert export_row.watermark is True
        ledger = CreditLedger.objects.get(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        )
        assert ledger.reference_id == str(export_row.id)
        user.refresh_from_db()
        assert user.credits_balance == 14
        usage = DailyUsage.objects.get(user=user, date=timezone.localdate())
        assert usage.export_rows == 1

    def test_free_user_rejected_xlsx(self, export_session: _Session, person: Person) -> None:
        client, _ = export_session(tier='free')
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'xlsx',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 403
        assert response.json()['code'] == 'starter_only'

    def test_free_user_xlsx_rejected_even_with_balance(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
    ) -> None:
        """Balance can never bypass the format gate (FR-18 forever)."""
        client, user = export_session(tier='free')
        grant(user, 15)
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'xlsx',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 403
        assert response.json()['code'] == 'starter_only'
        assert not Export.objects.filter(user=user).exists()
        assert not CreditLedger.objects.filter(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        ).exists()

    def test_starter_only_message_localized(
        self, export_session: _Session, person: Person
    ) -> None:
        client, _ = export_session(locale='fr', tier='free')
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'xlsx',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 403
        assert 'Starter' in response.json()['detail']

    def test_free_user_capped_to_first_five(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
    ) -> None:
        """The 5-row cap is SERVER-side: 8 ids in payload order → the first 5
        are exported (the modal's payload order == current sort order)."""
        client, user = export_session(tier='free')
        grant(user, 15)
        ids = [str(person.id)]
        for index in range(7):
            ids.append(
                str(
                    Person.objects.create(
                        name=f'Row {index}', role='Manager', source='seed'
                    ).id
                )
            )
        response = _post(
            client,
            {
                'record_ids': ids,
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body['row_count'] == 5
        assert body['unrevealed_count'] == 5
        assert body['credits_cost'] == 5
        assert body['watermark'] is True
        export_row = Export.objects.get(user=user)
        assert len(export_row.rows_json['rows']) == 5
        snapshot_names = [row['name'] for row in export_row.rows_json['rows']]
        # Order preservation is the contract: the snapshot replays the FIRST
        # 5 of the payload order (== current sort order), not DB order.
        assert snapshot_names == ['Karim Benali', 'Row 0', 'Row 1', 'Row 2', 'Row 3']
        user.refresh_from_db()
        assert user.credits_balance == 10
        usage = DailyUsage.objects.get(user=user, date=timezone.localdate())
        assert usage.export_rows == 5

    def test_free_cap_applies_before_unrevealed_filter(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
    ) -> None:
        """Cap slices FIRST, then the include_unrevealed filter applies: a free
        user with nothing revealed + unchecking include_unrevealed → 400 (the
        existing no-rows rule), nothing written."""
        client, user = export_session(tier='free')
        grant(user, 15)
        ids = [str(person.id)]
        for index in range(7):
            ids.append(
                str(
                    Person.objects.create(
                        name=f'Row {index}', role='Manager', source='seed'
                    ).id
                )
            )
        response = _post(
            client,
            {
                'record_ids': ids,
                'format': 'csv',
                'include_unrevealed': False,
            },
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'
        assert not Export.objects.filter(user=user).exists()
        assert not CreditLedger.objects.filter(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        ).exists()
        usage = DailyUsage.objects.filter(user=user, date=timezone.localdate()).first()
        assert usage is None or usage.export_rows == 0

    def test_free_user_watermark_frozen_in_snapshot(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
    ) -> None:
        """D3: the watermark STRING freezes into rows_json (which-string, not
        just the boolean) so the download replays byte-for-byte; watermark
        rows are NEVER stored in the snapshot's rows."""
        from apps.exports.messages import WATERMARK_MESSAGES

        client, user = export_session(locale='fr', tier='free')
        grant(user, 15)
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        export_row = Export.objects.get(user=user)
        assert export_row.rows_json['watermark'] == WATERMARK_MESSAGES['fr']
        assert len(export_row.rows_json['rows']) == 1

    def test_free_export_at_quota_headroom_rejected_atomically(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        seed_usage: Callable[..., Any],
        person: Person,
    ) -> None:
        """D7: the 5,000/24h quota counts free exports too — 429 rolls the
        debit back."""
        client, user = export_session(tier='free')
        grant(user, 15)
        seed_usage(user, 4998)
        second = Person.objects.create(name='Second Person', role='Manager', source='seed')
        third = Person.objects.create(name='Third Person', role='Dev', source='seed')
        response = _post(
            client,
            {
                'record_ids': [str(person.id), str(second.id), str(third.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 429
        body = response.json()
        assert body['code'] == 'export_limit_exceeded'
        assert body['limit'] == 5000
        assert not Export.objects.filter(user=user).exists()
        assert not CreditLedger.objects.filter(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        ).exists()
        usage = DailyUsage.objects.get(user=user, date=timezone.localdate())
        assert usage.export_rows == 4998
        user.refresh_from_db()
        assert user.credits_balance == 15

    def test_free_export_fits_quota_headroom(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        seed_usage: Callable[..., Any],
        person: Person,
    ) -> None:
        client, user = export_session(tier='free')
        grant(user, 15)
        seed_usage(user, 4998)
        second = Person.objects.create(name='Second Person', role='Manager', source='seed')
        response = _post(
            client,
            {
                'record_ids': [str(person.id), str(second.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body['watermark'] is True
        assert body['row_count'] == 2
        assert body['credits_cost'] == 2
        assert body['balances'] == {
            'subscription_balance': 13,
            'pack_balance': 0,
            'display_balance': 13,
        }
        export_row = Export.objects.get(user=user)
        assert export_row.watermark is True
        ledger = CreditLedger.objects.get(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        )
        assert ledger.amount == -2
        usage = DailyUsage.objects.get(user=user, date=timezone.localdate())
        assert usage.export_rows == 5000
        user.refresh_from_db()
        assert user.credits_balance == 13

    def test_free_insufficient_credits_nothing_written(
        self, export_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        """The AC's 'credits apply': a free user with balance 3 requesting a
        5-row export → 402, atomic rollback."""
        client, user = export_session(tier='free')
        grant(user, 3)
        ids = [str(person.id)]
        for index in range(4):
            ids.append(
                str(
                    Person.objects.create(
                        name=f'Row {index}', role='Manager', source='seed'
                    ).id
                )
            )
        response = _post(
            client,
            {
                'record_ids': ids,
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 402
        assert response.json()['code'] == 'insufficient_credits'
        assert not Export.objects.filter(user=user).exists()
        assert not CreditLedger.objects.filter(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        ).exists()
        usage = DailyUsage.objects.filter(user=user, date=timezone.localdate()).first()
        assert usage is None or usage.export_rows == 0


class TestStrictPayload:
    def test_missing_record_ids(self, export_session: _Session, person: Person) -> None:
        client, _ = export_session()
        response = _post(client, {'format': 'csv', 'include_unrevealed': True})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_missing_format(self, export_session: _Session, person: Person) -> None:
        client, _ = export_session()
        response = _post(client, {'record_ids': [str(person.id)], 'include_unrevealed': True})
        assert response.status_code == 400

    def test_missing_include_unrevealed(self, export_session: _Session, person: Person) -> None:
        client, _ = export_session()
        response = _post(client, {'record_ids': [str(person.id)], 'format': 'csv'})
        assert response.status_code == 400

    def test_extra_key_rejected(self, export_session: _Session, person: Person) -> None:
        client, _ = export_session()
        payload = {
            'record_ids': [str(person.id)],
            'format': 'csv',
            'include_unrevealed': True,
            'extra': 1,
        }
        response = _post(client, payload)
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_record_ids_not_list(self, export_session: _Session, person: Person) -> None:
        client, _ = export_session()
        response = _post(
            client,
            {
                'record_ids': str(person.id),
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 400

    def test_empty_record_ids(self, export_session: _Session) -> None:
        client, _ = export_session()
        response = _post(
            client,
            {'record_ids': [], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 400

    def test_non_string_record_id(self, export_session: _Session) -> None:
        client, _ = export_session()
        response = _post(
            client,
            {'record_ids': [123], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 400

    def test_too_many_record_ids(self, export_session: _Session) -> None:
        client, _ = export_session()
        response = _post(
            client,
            {
                'record_ids': [str(uuid.uuid4()) for _ in range(5001)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 400

    def test_invalid_format(self, export_session: _Session, person: Person) -> None:
        client, _ = export_session()
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'pdf',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 400

    def test_include_unrevealed_not_boolean(
        self, export_session: _Session, person: Person
    ) -> None:
        client, _ = export_session()
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'csv',
                'include_unrevealed': 1,
            },
        )
        assert response.status_code == 400

    def test_mixed_record_types_rejected(
        self, export_session: _Session, person: Person, company: Company
    ) -> None:
        client, _ = export_session()
        response = _post(
            client,
            {
                'record_ids': [str(person.id), str(company.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_unresolved_id_nothing_written(
        self, export_session: _Session, grant: Callable[..., Any]
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        response = _post(
            client,
            {'record_ids': [str(uuid.uuid4())], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 404
        assert response.json()['code'] == 'record_not_found'
        assert not Export.objects.filter(user=user).exists()
        assert not CreditLedger.objects.filter(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        ).exists()
        usage = DailyUsage.objects.filter(user=user, date=timezone.localdate()).first()
        assert usage is None or usage.export_rows == 0


class TestCreateExport:
    def test_non_canonical_uuid_forms_resolve(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
        reveal: Callable[..., Any],
    ) -> None:
        """Uppercase / braced / compact UUID forms must resolve — never 500
        (the 4.1 canonicalization guard, review finding)."""
        client, user = export_session()
        grant(user, 15)
        reveal(user, 'people', str(person.id))
        canonical = str(person.id)
        variants = [
            canonical.upper(),
            '{' + canonical + '}',
            canonical.replace('-', ''),
        ]
        for variant in variants:
            response = _post(
                client,
                {
                    'record_ids': [variant],
                    'format': 'csv',
                    'include_unrevealed': True,
                },
            )
            assert response.status_code == 200, variant
            body = response.json()
            assert body['revealed_count'] == 1, variant
            assert body['credits_cost'] == 1, variant
            export_row = Export.objects.filter(user=user).latest('created_at')
            assert export_row.rows_json['rows'][0]['revealed'] is True

    def test_unparseable_id_is_400_not_404(
        self, export_session: _Session, grant: Callable[..., Any]
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        response = _post(
            client,
            {
                'record_ids': ['not-a-uuid-at-all'],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_duplicate_record_ids_deduped(
        self, export_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        response = _post(
            client,
            {
                'record_ids': [str(person.id), str(person.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body['row_count'] == 1
        assert body['credits_cost'] == 1
        export_row = Export.objects.get(user=user)
        assert len(export_row.rows_json['rows']) == 1

    def test_free_user_malformed_payload_gets_400_not_403(
        self, export_session: _Session
    ) -> None:
        client, _ = export_session(tier='free')
        response = _post(client, {'record_ids': [], 'format': 'csv', 'include_unrevealed': True})
        assert response.status_code == 400
        assert response.json()['code'] == 'invalid_payload'

    def test_reveal_beyond_30d_window_counts_as_unrevealed(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
        reveal: Callable[..., Any],
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        reveal_row = reveal(user, 'people', str(person.id))
        from datetime import timedelta

        from django.utils import timezone

        from apps.credits.models import Reveal

        Reveal.objects.filter(pk=reveal_row.pk).update(
            created_at=timezone.now() - timedelta(days=31)
        )
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body['revealed_count'] == 0
        assert body['unrevealed_count'] == 1
        assert body['credits_cost'] == 1

    def test_snapshot_freezes_header_labels(
        self, export_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = export_session(locale='fr')
        grant(user, 15)
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        export_row = Export.objects.get(user=user)
        frozen = export_row.rows_json['headers']
        assert frozen['name'] == 'Nom'

    def test_concurrent_failure_maps_to_409(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
        monkeypatch: Any,
    ) -> None:
        from django.db import OperationalError

        from apps.exports.messages import CONCURRENT_EXPORT_MESSAGES

        client, user = export_session()
        grant(user, 15)

        def _boom(*args: Any, **kwargs: Any) -> Any:
            raise OperationalError('could not serialize access due to concurrent update')

        # The view imports the symbol into its own namespace — patch there.
        import apps.exports.views as exports_views

        monkeypatch.setattr(exports_views, 'create_export', _boom)
        response = _post(
            client,
            {
                'record_ids': [str(person.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 409
        body = response.json()
        assert body['code'] == 'concurrent_export'
        assert body['detail'] == CONCURRENT_EXPORT_MESSAGES['en']

    def test_happy_path_csv(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
        reveal: Callable[..., Any],
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        second = Person.objects.create(
            name='Second Person', role='Manager', source='seed'
        )
        third = Person.objects.create(
            name='Third Person', role='Dev', source='seed'
        )
        reveal(user, 'people', str(person.id))
        reveal(user, 'people', str(second.id))
        response = _post(
            client,
            {
                'record_ids': [str(person.id), str(second.id), str(third.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert set(body) == {
            'id',
            'format',
            'row_count',
            'revealed_count',
            'unrevealed_count',
            'credits_cost',
            'included_unrevealed',
            'watermark',
            'created_at',
            'balances',
        }
        assert body['format'] == 'csv'
        assert body['row_count'] == 3
        assert body['revealed_count'] == 2
        assert body['unrevealed_count'] == 1
        assert body['credits_cost'] == 3
        assert body['included_unrevealed'] is True
        assert body['watermark'] is False
        assert body['balances'] == {
            'subscription_balance': 12,
            'pack_balance': 0,
            'display_balance': 12,
        }
        ledger = CreditLedger.objects.get(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        )
        export_row = Export.objects.get(user=user)
        assert ledger.amount == -3
        assert ledger.balance_after == 12
        assert ledger.reference_id == str(export_row.id)
        assert export_row.row_count == 3
        assert export_row.credits_cost == 3
        assert export_row.format == 'csv'
        assert export_row.included_unrevealed is True
        assert export_row.watermark is False
        assert export_row.locale == 'en'
        assert export_row.rows_json['watermark'] is None
        assert len(export_row.rows_json['rows']) == 3
        user.refresh_from_db()
        assert user.credits_balance == 12
        usage = DailyUsage.objects.get(user=user, date=timezone.localdate())
        assert usage.export_rows == 3

    def test_snapshot_carries_contact_data_for_unrevealed_rows(
        self, export_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        response = _post(
            client,
            {'record_ids': [str(person.id)], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 200
        export_row = Export.objects.get(user=user)
        row = export_row.rows_json['rows'][0]
        assert row['email'] == 'karim@acme.dz'
        assert row['phone'] == '0550 12 34 56'
        assert row['address'] == 'Alger Centre, Alger'
        assert row['name'] == 'Karim Benali'

    def test_include_unrevealed_false_excludes_unrevealed_rows(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
        reveal: Callable[..., Any],
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        second = Person.objects.create(name='Second Person', role='Manager', source='seed')
        reveal(user, 'people', str(person.id))
        response = _post(
            client,
            {
                'record_ids': [str(person.id), str(second.id)],
                'format': 'csv',
                'include_unrevealed': False,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body['row_count'] == 1
        assert body['revealed_count'] == 1
        assert body['unrevealed_count'] == 0
        assert body['credits_cost'] == 1
        export_row = Export.objects.get(user=user)
        assert len(export_row.rows_json['rows']) == 1
        usage = DailyUsage.objects.get(user=user, date=timezone.localdate())
        assert usage.export_rows == 1

    def test_insufficient_credits_nothing_written(
        self, export_session: _Session, person: Person
    ) -> None:
        client, user = export_session()
        response = _post(
            client,
            {'record_ids': [str(person.id)], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 402
        assert response.json()['code'] == 'insufficient_credits'
        assert not Export.objects.filter(user=user).exists()
        assert not CreditLedger.objects.filter(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        ).exists()
        usage = DailyUsage.objects.filter(user=user, date=timezone.localdate()).first()
        assert usage is None or usage.export_rows == 0

    def test_rate_limit_at_headroom_rejected_atomically(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        seed_usage: Callable[..., Any],
        person: Person,
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        seed_usage(user, 4998)
        second = Person.objects.create(name='Second Person', role='Manager', source='seed')
        third = Person.objects.create(name='Third Person', role='Dev', source='seed')
        response = _post(
            client,
            {
                'record_ids': [str(person.id), str(second.id), str(third.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 429
        body = response.json()
        assert body['code'] == 'export_limit_exceeded'
        assert body['limit'] == 5000
        assert not Export.objects.filter(user=user).exists()
        assert not CreditLedger.objects.filter(
            user=user, event_type=CreditEventType.EXPORT_ROW_DEBIT
        ).exists()
        usage = DailyUsage.objects.get(user=user, date=timezone.localdate())
        assert usage.export_rows == 4998
        user.refresh_from_db()
        assert user.credits_balance == 15

    def test_rate_limit_fits_headroom(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        seed_usage: Callable[..., Any],
        person: Person,
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        seed_usage(user, 4998)
        second = Person.objects.create(name='Second Person', role='Manager', source='seed')
        response = _post(
            client,
            {
                'record_ids': [str(person.id), str(second.id)],
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        usage = DailyUsage.objects.get(user=user, date=timezone.localdate())
        assert usage.export_rows == 5000

    def test_rate_limit_at_cap_rejected(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        seed_usage: Callable[..., Any],
        person: Person,
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        seed_usage(user, 5000)
        response = _post(
            client,
            {'record_ids': [str(person.id)], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 429

    def test_rate_limit_message_localized_ar(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        seed_usage: Callable[..., Any],
        person: Person,
    ) -> None:
        client, user = export_session(locale='ar')
        grant(user, 15)
        seed_usage(user, 5000)
        response = _post(
            client,
            {'record_ids': [str(person.id)], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 429
        assert response.json()['detail'] == EXPORT_LIMIT_MESSAGES['ar']

    def test_company_export_happy_path(
        self, export_session: _Session, grant: Callable[..., Any], company: Company
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        response = _post(
            client,
            {'record_ids': [str(company.id)], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 200
        body = response.json()
        assert body['row_count'] == 1
        assert body['credits_cost'] == 1
        export_row = Export.objects.get(user=user)
        assert export_row.rows_json['record_type'] == 'company'
        row = export_row.rows_json['rows'][0]
        assert row['name'] == 'ACME Algérie'
        assert row['website'] == 'https://acme.dz'
        # Data values never translate (D5/FR-3) — the industry cell carries
        # the canonical name_en (empty when the fixture has no industry);
        # only headers and wilaya localize.
        assert row['industry'] == ''
        assert 'people_count' in row

    def test_company_download_body_contract(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        company: Company,
    ) -> None:
        from apps.search.models import Industry, Wilaya

        industry = Industry.objects.create(
            name_ar='دعاية', name_fr='Publicité', name_en='Advertising E2E44'
        )
        wilaya = Wilaya.objects.get(code=31)
        company.industry = industry
        company.wilaya_code = wilaya
        company.size_band = '11-50'
        company.save()
        client, user = export_session(locale='fr')
        grant(user, 15)
        response = _post(
            client,
            {'record_ids': [str(company.id)], 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 200
        export_id = response.json()['id']
        download = client.get(f'/api/export/{export_id}/download/')
        assert download.status_code == 200
        text = b''.join(download.streaming_content).decode('utf-8-sig')
        assert 'Nom,Secteur,Wilaya,Taille,Site web,Effectif' in text
        assert 'Advertising E2E44' in text
        assert 'Oran (31)' in text
        assert '11-50' in text



class TestDownload:
    def _create(self, client: Client, ids: list[str]) -> str:
        response = _post(
            client,
            {'record_ids': ids, 'format': 'csv', 'include_unrevealed': True},
        )
        assert response.status_code == 200
        export_id = response.json()['id']
        assert isinstance(export_id, str)
        return export_id

    def test_download_csv_contract(
        self, export_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = export_session(locale='fr')
        grant(user, 15)
        export_id = self._create(client, [str(person.id)])
        response = client.get(f'/api/export/{export_id}/download/')
        assert response.status_code == 200
        assert response['Content-Type'].startswith('text/csv')
        disposition = response['Content-Disposition']
        assert 'attachment' in disposition
        assert f'filename="dzleads-export-{export_id}.csv"' in disposition
        content = b''.join(response.streaming_content)
        assert content.startswith(b'\xef\xbb\xbf')
        text = content.decode('utf-8-sig')
        assert text.startswith('Nom,')
        assert 'karim@acme.dz' in text
        assert '0550 12 34 56' in text

    def test_download_xlsx_contract(
        self, export_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        response = _post(
            client,
            {'record_ids': [str(person.id)], 'format': 'xlsx', 'include_unrevealed': True},
        )
        assert response.status_code == 200
        export_id = response.json()['id']
        download = client.get(f'/api/export/{export_id}/download/')
        assert download.status_code == 200
        assert (
            download['Content-Type']
            == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        assert f'filename="dzleads-export-{export_id}.xlsx"' in download['Content-Disposition']

    def test_download_foreign_export_404(
        self, export_session: _Session, grant: Callable[..., Any], person: Person
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        export_id = self._create(client, [str(person.id)])
        other_client, other_user = export_session()
        other_user.refresh_from_db()
        grant(other_user, 15)
        response = other_client.get(f'/api/export/{export_id}/download/')
        assert response.status_code == 404
        assert response.json()['code'] == 'record_not_found'

    def test_download_unknown_export_404(
        self, export_session: _Session, grant: Callable[..., Any]
    ) -> None:
        client, user = export_session()
        grant(user, 15)
        response = client.get(f'/api/export/{uuid.uuid4()}/download/')
        assert response.status_code == 404
        assert response.json()['code'] == 'record_not_found'

    def test_download_garbage_id_404(self, export_session: _Session) -> None:
        client, _ = export_session()
        response = client.get('/api/export/not-a-uuid/download/')
        assert response.status_code == 404
        assert response.json()['code'] == 'record_not_found'

    def test_download_anonymous_401(self, api_client: Client) -> None:
        response = api_client.get(f'/api/export/{uuid.uuid4()}/download/')
        assert response.status_code == 401

    def test_free_export_download_watermark_contract(
        self,
        export_session: _Session,
        grant: Callable[..., Any],
        person: Person,
    ) -> None:
        """The free file replays byte-for-byte with the literal watermark
        header + footer rows around the 5 data rows (D3/FR-19)."""
        from apps.exports.messages import WATERMARK_MESSAGES

        client, user = export_session(tier='free')
        grant(user, 15)
        ids = [str(person.id)]
        for index in range(4):
            ids.append(
                str(
                    Person.objects.create(
                        name=f'Row {index}', role='Manager', source='seed'
                    ).id
                )
            )
        response = _post(
            client,
            {
                'record_ids': ids,
                'format': 'csv',
                'include_unrevealed': True,
            },
        )
        assert response.status_code == 200
        export_id = response.json()['id']
        first = client.get(f'/api/export/{export_id}/download/')
        second = client.get(f'/api/export/{export_id}/download/')
        assert first.status_code == 200
        assert first['Content-Type'].startswith('text/csv')
        content = b''.join(first.streaming_content)
        assert b''.join(second.streaming_content) == content
        assert content.startswith(b'\xef\xbb\xbf')
        lines = content.decode('utf-8-sig').rstrip('\r\n').split('\r\n')
        watermark = WATERMARK_MESSAGES['en']
        assert lines[0] == watermark
        assert lines[1].startswith('Name,Role')
        assert len(lines) == 8  # wm header + column header + 5 data + wm footer
        assert lines[-1] == watermark
        assert all(len(line) > 0 for line in lines[2:7])
