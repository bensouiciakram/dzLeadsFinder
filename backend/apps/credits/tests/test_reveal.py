"""Reveal service tests: atomic debit (SERIALIZABLE), drawdown, re-reveal idempotency."""

import inspect
import uuid
from datetime import timedelta
from typing import Any, cast

import pytest
from django.contrib.auth import get_user_model
from django.db.models import F, Sum
from django.utils import timezone

from apps.credits.models import CreditLedger, Reveal
from apps.credits.services import (
    InsufficientCreditsError,
    RevealRecordNotFoundError,
    reveal_contact,
)
from apps.search.models import Company, Person

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def person(company: Company) -> Person:
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
def user_with(create_user: Any) -> Any:
    def _grant(amount: int, pool: str = 'subscription', event: str = 'subscription_grant') -> Any:
        create_user.refresh_from_db()
        total = (
            CreditLedger.objects.filter(user=create_user).aggregate(total=Sum('amount'))['total']
            or 0
        )
        CreditLedger.objects.create(
            user=create_user,
            event_type=event,
            amount=amount,
            balance_after=total + amount,
            pool=pool,
        )
        User.objects.filter(pk=create_user.pk).update(
            credits_balance=F('credits_balance') + amount
        )
        create_user.refresh_from_db()
        return create_user

    return _grant


class TestPaidDebit:
    def test_returns_contact_data_and_writes_ledger_reveal_and_cache(
        self, user_with: Any, person: Person, create_user: Any
    ) -> None:
        user = user_with(3)
        result = reveal_contact(user, 'people', str(person.id))

        assert result['name'] == 'Karim Benali'
        assert result['email'] == 'karim@acme.dz'
        assert result['phone'] == '0550 12 34 56'
        assert result['address'] == 'Alger Centre, Alger'
        assert result['company_name'] == 'ACME Algérie'
        assert set(result) == {
            'name', 'role', 'company_name', 'email', 'phone', 'address', 'record_type', 'record_id'
        }

        ledger = CreditLedger.objects.get(user=user, event_type='reveal_debit')
        assert ledger.amount == -1
        assert ledger.pool == 'subscription'
        assert ledger.balance_after == 2

        reveal = Reveal.objects.get(user=user, record_type='people', record_id=str(person.id))
        assert reveal.credit_cost == 1
        assert reveal.was_free is False

        user.refresh_from_db()
        assert user.credits_balance == 2

    def test_drawdown_subscription_first(self, user_with: Any, person: Person) -> None:
        user = user_with(3)
        user_with(5, pool='pack', event='pack_grant')
        reveal_contact(user, 'people', str(person.id))
        assert CreditLedger.objects.get(user=user, event_type='reveal_debit').pool == 'subscription'

    def test_ac_pin_subscription_drawn_before_pack_and_pack_untouched(
        self, user_with: Any, person: Person
    ) -> None:
        """5.4 Task 7 — the AC drawdown clause pinned verbatim (AD-7): with
        BOTH pools funded, the reveal draws the subscription pool first and
        the pack pool balance is untouched; the display balance stays the
        combined total (the 5.5 cards / 4.3 pill contract)."""
        user = user_with(3, event='subscription_grant', pool='subscription')
        user_with(5, pool='pack', event='pack_grant')
        reveal_contact(user, 'people', str(person.id))

        debit = CreditLedger.objects.get(user=user, event_type='reveal_debit')
        assert debit.pool == 'subscription'
        assert debit.amount == -1
        pack_total = CreditLedger.objects.filter(user=user, pool='pack').aggregate(
            total=Sum('amount')
        )['total']
        assert pack_total == 5
        from apps.credits.services import user_balances

        assert user_balances(user) == {
            'subscription_balance': 2,
            'pack_balance': 5,
            'display_balance': 7,
        }

    def test_drawdown_pack_when_subscription_empty(self, user_with: Any, person: Person) -> None:
        user = user_with(5, pool='pack', event='pack_grant')
        reveal_contact(user, 'people', str(person.id))
        assert CreditLedger.objects.get(user=user, event_type='reveal_debit').pool == 'pack'

    def test_insufficient_balance_rolls_back_and_raises(
        self, user_with: Any, person: Person
    ) -> None:
        user = user_with(0)
        with pytest.raises(InsufficientCreditsError):
            reveal_contact(user, 'people', str(person.id))
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 0
        assert Reveal.objects.filter(user=user).count() == 0
        user.refresh_from_db()
        assert user.credits_balance == 0

    def test_balance_comes_from_ledger_not_cache(self, create_user: Any, person: Person) -> None:
        user = create_user
        user.credits_balance = 5
        user.save(update_fields=['credits_balance'])
        with pytest.raises(InsufficientCreditsError):
            reveal_contact(user, 'people', str(person.id))
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 0
        user.refresh_from_db()
        assert user.credits_balance == 5

    def test_uses_serializable_isolation_on_postgresql_only(self) -> None:
        source = inspect.getsource(__import__('apps.credits.services', fromlist=['reveal_contact']))
        assert 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE' in source
        assert "vendor == 'postgresql'" in source

    def test_company_reveal_returns_company_contact_data(
        self, user_with: Any, company: Company
    ) -> None:
        user = user_with(2)
        result = reveal_contact(user, 'company', str(company.id))
        assert result['name'] == 'ACME Algérie'
        assert result['website'] == 'https://acme.dz'
        assert set(result) == {
            'name', 'industry', 'website', 'wilaya_code', 'size_band', 'record_type', 'record_id'
        }
        paid = Reveal.objects.get(
            user=user, record_type='company', record_id=str(company.id)
        )
        assert paid.was_free is False

    def test_record_not_found_writes_nothing(self, user_with: Any) -> None:
        user = user_with(3)
        with pytest.raises(RevealRecordNotFoundError):
            reveal_contact(user, 'people', str(uuid.uuid4()))
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 0
        assert Reveal.objects.filter(user=user).count() == 0

    def test_unparseable_record_id_raises_not_found_not_crash(
        self, user_with: Any
    ) -> None:
        user = user_with(3)
        with pytest.raises(RevealRecordNotFoundError):
            reveal_contact(user, 'people', 'not-a-uuid')
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 0

    def test_non_canonical_record_id_is_stored_canonically(
        self, user_with: Any, person: Person
    ) -> None:
        """Uppercase/brace forms must resolve to the SAME paid row — never
        a duplicate paid reveal or a second charge."""
        user = user_with(3)
        upper = str(person.id).upper()
        braced = f'{{{str(person.id)}}}'
        reveal_contact(user, 'people', upper)
        reveal_contact(user, 'people', braced)

        assert Reveal.objects.filter(user=user, record_id=str(person.id)).count() == 2
        assert Reveal.objects.filter(user=user, was_free=True).count() == 1
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 1
        user.refresh_from_db()
        assert user.credits_balance == 2


class TestReRevealIdempotency:
    def test_within_30_days_is_free(self, user_with: Any, person: Person) -> None:
        user = user_with(3)
        first = reveal_contact(user, 'people', str(person.id))
        second = reveal_contact(user, 'people', str(person.id))

        assert second['email'] == first['email']
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 1
        free_row = Reveal.objects.filter(user=user, record_id=str(person.id), was_free=True)
        assert free_row.count() == 1
        user.refresh_from_db()
        assert user.credits_balance == 2

    def test_window_is_inclusive_of_the_30_day_boundary(
        self, user_with: Any, person: Person
    ) -> None:
        user = user_with(3)
        reveal_contact(user, 'people', str(person.id))
        Reveal.objects.update(created_at=timezone.now() - timedelta(days=30) + timedelta(seconds=1))
        reveal_contact(user, 'people', str(person.id))
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 1

    def test_beyond_30_days_debits_again_and_renews_the_paid_row(
        self, user_with: Any, person: Person
    ) -> None:
        user = user_with(3)
        reveal_contact(user, 'people', str(person.id))
        Reveal.objects.update(created_at=timezone.now() - timedelta(days=30) - timedelta(seconds=1))
        before = timezone.now()
        reveal_contact(user, 'people', str(person.id))

        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 2
        paid_rows = Reveal.objects.filter(user=user, record_id=str(person.id), was_free=False)
        assert paid_rows.count() == 1
        paid_rows.first().refresh_from_db()
        assert paid_rows.first().created_at >= before
        user.refresh_from_db()
        assert user.credits_balance == 1

    def test_free_re_reveal_of_free_re_reveal_never_charges(
        self, user_with: Any, person: Person
    ) -> None:
        user = user_with(1)
        reveal_contact(user, 'people', str(person.id))
        reveal_contact(user, 'people', str(person.id))
        reveal_contact(user, 'people', str(person.id))
        assert Reveal.objects.filter(user=user).count() == 3
        assert Reveal.objects.filter(user=user, was_free=True).count() == 2
        user.refresh_from_db()
        assert user.credits_balance == 0

    def test_different_records_charge_separately(self, user_with: Any, person: Person) -> None:
        user = user_with(2)
        second_person = Person.objects.create(name='Amine Khelifi', source='seed')
        reveal_contact(user, 'people', str(person.id))
        reveal_contact(user, 'people', str(second_person.id))
        assert CreditLedger.objects.filter(user=user, event_type='reveal_debit').count() == 2
        user.refresh_from_db()
        assert user.credits_balance == 0
