"""Export creation orchestration: resolve → generate → ONE atomic debit.

The whole export POST is all-or-nothing (the 4.1 SERIALIZABLE contract):
file generation runs BEFORE the transaction (a generation failure returns
with ZERO debit), then `debit_export_rows` — the FIRST statement of the
atomic block, holding the SERIALIZABLE guard + the user-row lock — is
followed by the quota check+increment and the exports-row insert. A 429
or 402 rolls the block back: a rejected export never burns credits.
"""

import uuid
from datetime import timedelta
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, F
from django.utils import timezone

from apps.credits.models import Reveal
from apps.credits.services import debit_export_rows
from apps.exports.export_service import EXPORT_FORMATS, build_export_file
from apps.exports.messages import EXPORT_CSV_HEADERS, WATERMARK_MESSAGES
from apps.exports.models import Export
from apps.exports.quota import EXPORT_DAILY_ROW_LIMIT
from apps.search.models import Company, DailyUsage, Person

_FORMATS = frozenset(EXPORT_FORMATS)
_MAX_IDS = EXPORT_DAILY_ROW_LIMIT
_MAX_ID_LENGTH = 200
_REVEALED_WINDOW_DAYS = 30
# FR-19: the free-tier CSV cap — 5 rows, the FIRST 5 of the payload order
# (the modal's payload order == current sort order; the server NEVER trusts
# the client's list size).
_FREE_EXPORT_CAP = 5


class InvalidExportPayloadError(Exception):
    """The POST payload violates the strict contract."""


class ExportRecordNotFoundError(Exception):
    """At least one record id does not resolve to a known record."""


class ExportLimitExceededError(Exception):
    """The export would exceed the 5,000 rows/24h headroom (FR-20)."""


def _validate_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise InvalidExportPayloadError('Payload must be a JSON object.')
    if set(payload) != {'record_ids', 'format', 'include_unrevealed'}:
        raise InvalidExportPayloadError(
            'Exactly {record_ids, format, include_unrevealed} is accepted.'
        )
    format_ = payload['format']
    if format_ not in _FORMATS:
        raise InvalidExportPayloadError("format must be 'csv' or 'xlsx'.")
    include_unrevealed = payload['include_unrevealed']
    if include_unrevealed is not True and include_unrevealed is not False:
        raise InvalidExportPayloadError('include_unrevealed must be a boolean.')
    record_ids = payload['record_ids']
    if not isinstance(record_ids, list):
        raise InvalidExportPayloadError('record_ids must be a list.')
    if not record_ids:
        raise InvalidExportPayloadError('record_ids must not be empty.')
    if len(record_ids) > _MAX_IDS:
        raise InvalidExportPayloadError(
            f'record_ids must not exceed {_MAX_IDS} entries.'
        )
    # Canonicalize + dedupe (order-preserving): UUIDs have many textual forms
    # (uppercase, no hyphens, braces) — the DB would resolve them via
    # UUIDField but the snapshot dict is keyed by str(record.id), and the
    # reveals table stores only canonical forms. Unparseable ids are payload
    # errors (400), not record-not-found (404). Duplicates would otherwise
    # mis-branch the resolver (404 for an existing id) and double-count rows.
    canonical_ids: list[str] = []
    seen: set[str] = set()
    for record_id in record_ids:
        if not isinstance(record_id, str) or not record_id or len(record_id) > _MAX_ID_LENGTH:
            raise InvalidExportPayloadError(
                'record_ids entries must be non-empty strings.'
            )
        try:
            canonical = str(uuid.UUID(record_id))
        except (ValueError, AttributeError, TypeError):
            raise InvalidExportPayloadError(
                'record_ids entries must be valid record ids.'
            ) from None
        if canonical not in seen:
            seen.add(canonical)
            canonical_ids.append(canonical)
    return {
        'record_ids': canonical_ids,
        'format': format_,
        'include_unrevealed': include_unrevealed,
    }


def _resolve_record_type(record_ids: list[str]) -> tuple[str, dict[str, Any]]:
    """Resolve the id set to ONE record type; returns (type, records-by-id).

    The dict is keyed by the CANONICAL id (str(record.id)) — UUIDs have many
    textual forms (uppercase, no hyphens, braces) and membership checks must
    never use the raw client string (the 4.1 canonicalization guard).
    """
    try:
        people = Person.objects.filter(pk__in=record_ids).select_related(
            'company__wilaya_code'
        )
    except (ValueError, TypeError, ValidationError):
        people = Person.objects.none()
    people_by_id = {str(record.id): record for record in people}
    people_matched = len(people_by_id)
    try:
        companies = Company.objects.filter(pk__in=record_ids).select_related(
            'industry', 'wilaya_code'
        ).annotate(people_count=Count('people'))
    except (ValueError, TypeError, ValidationError):
        companies = Company.objects.none()
    companies_by_id = {str(record.id): record for record in companies}
    companies_matched = len(companies_by_id)
    if people_matched + companies_matched < len(record_ids):
        raise ExportRecordNotFoundError(
            'Some record ids do not resolve to a known record.'
        )
    if people_matched > 0 and companies_matched > 0:
        raise InvalidExportPayloadError(
            'All record ids must reference the same record type.'
        )
    if people_matched == len(record_ids):
        return 'people', people_by_id
    return 'company', companies_by_id


def _wilaya_display(record: Any, locale: str) -> str:
    wilaya = getattr(record, 'wilaya_code')
    if wilaya is None:
        return ''
    name = getattr(wilaya, f'name_{locale}', None) or wilaya.name_en
    return f'{name} ({wilaya.code})'


def _people_row(record: Any, locale: str) -> dict[str, str]:
    company = record.company
    return {
        'name': record.name,
        'role': record.role or '',
        'company': company.name if company is not None else '',
        'wilaya': _wilaya_display(company, locale) if company is not None else '',
        'email': record.email or '',
        'phone': record.phone or '',
        'address': record.address or '',
    }


def _company_row(record: Any, locale: str) -> dict[str, str | int]:
    industry = record.industry
    return {
        'name': record.name,
        'industry': industry.name_en if industry is not None else '',
        'wilaya': _wilaya_display(record, locale),
        'size_band': record.size_band or '',
        'website': record.website or '',
        'people_count': getattr(record, 'people_count', 0),
    }


def _revealed_ids(user: Any, record_type: str, record_ids: list[str]) -> set[str]:
    return set(
        Reveal.objects.filter(
            user_id=user.id,
            record_type=record_type,
            record_id__in=record_ids,
            created_at__gte=timezone.now() - timedelta(days=_REVEALED_WINDOW_DAYS),
        ).values_list('record_id', flat=True)
    )


def create_export(user: Any, payload: Any, watermark: bool = False) -> tuple[Export, int]:
    """Create an export job: resolves, generates, debits atomically.

    Returns (export_row, revealed_count) — the revealed/unrevealed
    breakdown over the EXPORTED set (the "n revealed + m unrevealed =
    total credits" contract).

    `watermark` (FR-19, free tier): when True the export is capped to the
    FIRST 5 ids of the payload order (server-side — the client may send up
    to 5,000 ids but never controls the cap) and the file gains the literal
    watermark header/footer rows. The service enforces cap + watermark
    itself so a direct service call can't bypass; the view only adds the
    format gate. The watermark STRING is frozen into the snapshot (D3) so
    the download replays byte-for-byte even if the copy later edits.
    """
    validated = _validate_payload(payload)
    record_ids = validated['record_ids']
    if watermark:
        # Cap BEFORE anything else: the first 5 of the payload order after
        # the order-preserving dedupe — payload order == result order ==
        # current sort order (the modal collector invariant).
        record_ids = record_ids[:_FREE_EXPORT_CAP]
    include_unrevealed = validated['include_unrevealed']
    format_ = validated['format']
    # The watermark flag is a CSV concept (FR-19): a watermarked xlsx is an
    # inconsistent state (the xlsx builder is watermark-unaware and would
    # silently produce an unwatermarked file billed as watermarked). The view
    # gates free+xlsx first, but the service must not trust the caller.
    if watermark and format_ != 'csv':
        raise InvalidExportPayloadError('watermark requires csv format.')

    record_type, records_by_id = _resolve_record_type(record_ids)
    revealed = _revealed_ids(user, record_type, record_ids)
    included_ids = (
        [record_id for record_id in record_ids if str(records_by_id[record_id].id) in revealed]
        if not include_unrevealed
        else list(record_ids)
    )
    if not included_ids:
        raise InvalidExportPayloadError('No rows to export with the current selection.')
    revealed_count = len(
        [record_id for record_id in included_ids if str(records_by_id[record_id].id) in revealed]
    )
    row_count = len(included_ids)

    locale = user.effective_locale
    headers = EXPORT_CSV_HEADERS[locale][record_type]
    if record_type == 'people':
        rows = [
            {
                **dict(_people_row(records_by_id[record_id], locale)),
                'revealed': str(records_by_id[record_id].id) in revealed,
            }
            for record_id in included_ids
        ]
    else:
        rows = [
            {
                **dict(_company_row(records_by_id[record_id], locale)),
                'revealed': str(records_by_id[record_id].id) in revealed,
            }
            for record_id in included_ids
        ]
    bytes_ = build_export_file(
        format_,
        rows,
        headers,
        watermark_text=WATERMARK_MESSAGES[locale] if watermark else None,
    )
    del bytes_  # generated pre-transaction: any failure here returns with ZERO debit

    export_id = uuid.uuid4()
    with transaction.atomic():
        # The debit must be the FIRST statement: the SERIALIZABLE guard pins
        # there (the 4.1 deferred-work composition contract).
        debit_export_rows(user, row_count, str(export_id))
        usage, _ = DailyUsage.objects.get_or_create(
            user=user, date=timezone.localdate()
        )
        if usage.export_rows + row_count > EXPORT_DAILY_ROW_LIMIT:
            raise ExportLimitExceededError(
                f'{usage.export_rows} + {row_count} exceeds the daily export limit'
            )
        DailyUsage.objects.filter(pk=usage.pk).update(
            export_rows=F('export_rows') + row_count
        )
        export_row = Export.objects.create(
            id=export_id,
            user=user,
            format=format_,
            row_count=row_count,
            credits_cost=row_count,
            included_unrevealed=include_unrevealed,
            watermark=watermark,
            rows_json={
                'record_type': record_type,
                'rows': rows,
                # Freeze the header labels at POST so download regeneration is
                # byte-for-byte (D3) — later label edits must never change
                # what a previously-paid file renders.
                'headers': headers,
                # Freeze the watermark STRING (which-string, not just the
                # boolean column): a paid export's download can never gain
                # watermark rows and a free export's download always replays
                # them byte-for-byte (D3). Absent = no watermark (legacy).
                'watermark': (
                    WATERMARK_MESSAGES[locale] if watermark else None
                ),
            },
            locale=locale,
        )
    return export_row, revealed_count
