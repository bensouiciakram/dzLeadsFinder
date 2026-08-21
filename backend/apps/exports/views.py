"""Export API views: POST /api/export/ + GET /api/export/{id}/download/.

Thin adapters (the 4.2 RevealView precedent): the POST gates the tier,
delegates to `create_export` DIRECTLY (never inside an outer
transaction.atomic() — the 4.1 SERIALIZABLE-composition contract), maps the
typed exceptions to HTTP, and attaches the confirmed ledger-derived
balances. The download is ownership-filtered (404 for unknown AND foreign
ids — no existence leak) and regenerates the file deterministically from
the frozen snapshot (the user paid for THAT file).
"""

import io

from django.core.exceptions import ValidationError
from django.db import IntegrityError, OperationalError
from django.http import FileResponse
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import TIER_FREE, TIER_STARTER
from apps.credits.messages import INSUFFICIENT_CREDITS_MESSAGES
from apps.credits.models import RECORD_TYPE_PEOPLE
from apps.credits.services import InsufficientCreditsError, user_balances
from apps.exports.export_service import build_export_file, export_mime
from apps.exports.messages import (
    CONCURRENT_EXPORT_MESSAGES,
    EXPORT_CSV_HEADERS,
    EXPORT_LIMIT_MESSAGES,
    EXPORT_RECORD_NOT_FOUND_MESSAGES,
    STARTER_ONLY_MESSAGES,
)
from apps.exports.models import Export
from apps.exports.quota import EXPORT_DAILY_ROW_LIMIT
from apps.exports.services import (
    ExportLimitExceededError,
    ExportRecordNotFoundError,
    InvalidExportPayloadError,
    _validate_payload,
    create_export,
)


class ExportView(APIView):
    """POST /api/export/ — create an export job (FR-17/18/19/20)."""

    def post(self, request: Request) -> Response:
        user = request.user
        locale = user.effective_locale
        # Payload validation runs BEFORE the tier gate so a malformed body is
        # always a 400 — never an ambiguous 403 that leaks entitlement state.
        try:
            _validate_payload(request.data)
        except InvalidExportPayloadError as exc:
            return Response(
                {'detail': str(exc), 'code': 'invalid_payload'}, status=400
            )
        # The 4.4 D8 split lands here (4.6): CSV is REAL for the free tier
        # (5-row cap + watermark — enforced inside create_export via the
        # watermark flag); xlsx stays starter-only FOREVER (FR-18) — the 403
        # starter_only remains ONLY for free+xlsx.
        tier = getattr(user, 'tier', TIER_FREE)
        if tier != TIER_STARTER and request.data.get('format') == 'xlsx':
            return Response(
                {'detail': STARTER_ONLY_MESSAGES[locale], 'code': 'starter_only'},
                status=403,
            )
        watermark = tier == TIER_FREE
        try:
            export_row, revealed_count = create_export(
                user, request.data, watermark=watermark
            )
        except InvalidExportPayloadError as exc:
            return Response(
                {'detail': str(exc), 'code': 'invalid_payload'}, status=400
            )
        except ExportRecordNotFoundError:
            return Response(
                {
                    'detail': EXPORT_RECORD_NOT_FOUND_MESSAGES[locale],
                    'code': 'record_not_found',
                },
                status=404,
            )
        except InsufficientCreditsError:
            return Response(
                {
                    'detail': INSUFFICIENT_CREDITS_MESSAGES[locale],
                    'code': 'insufficient_credits',
                },
                status=402,
            )
        except ExportLimitExceededError:
            return Response(
                {
                    'detail': EXPORT_LIMIT_MESSAGES[locale],
                    'code': 'export_limit_exceeded',
                    'limit': EXPORT_DAILY_ROW_LIMIT,
                },
                status=429,
            )
        except (IntegrityError, OperationalError):
            # A concurrent same-user export (or an export racing a reveal) lost
            # the serialization race: the user-row lock serializes, the loser
            # aborts on its first write and rolls back cleanly — nothing was
            # written here (the 4.2 concurrent_reveal precedent). Retryable.
            return Response(
                {
                    'detail': CONCURRENT_EXPORT_MESSAGES[locale],
                    'code': 'concurrent_export',
                },
                status=409,
            )
        balances = user_balances(user)
        return Response(
            {
                'id': str(export_row.id),
                'format': export_row.format,
                'row_count': export_row.row_count,
                'revealed_count': revealed_count,
                'unrevealed_count': export_row.row_count - revealed_count,
                'credits_cost': export_row.credits_cost,
                'included_unrevealed': export_row.included_unrevealed,
                'watermark': export_row.watermark,
                'created_at': export_row.created_at.isoformat(),
                'balances': balances,
            }
        )


class ExportDownloadView(APIView):
    """GET /api/export/{id}/download/ — serve the generated file."""

    def _owned_export(self, request: Request, export_id: str) -> Export | None:
        try:
            row = Export.objects.filter(user_id=request.user.id, pk=export_id).first()
        except (ValueError, TypeError, ValidationError):
            return None
        if row is None:
            return None
        assert isinstance(row, Export)
        return row

    def get(self, request: Request, export_id: str) -> Response:
        export_row = self._owned_export(request, export_id)
        locale = request.user.effective_locale
        if export_row is None:
            return Response(
                {
                    'detail': EXPORT_RECORD_NOT_FOUND_MESSAGES[locale],
                    'code': 'record_not_found',
                },
                status=404,
            )
        # Headers come from the FROZEN snapshot (D3 — byte-for-byte
        # regeneration: later label edits must never change what a
        # previously-paid file renders); the live dict is only the fallback
        # for exports created before the freeze landed.
        record_type = export_row.rows_json.get('record_type', RECORD_TYPE_PEOPLE)
        headers = export_row.rows_json.get('headers') or {}
        if not headers:
            headers = EXPORT_CSV_HEADERS.get(
                export_row.locale, EXPORT_CSV_HEADERS['en']
            ).get(record_type, {})
        rows = export_row.rows_json.get('rows', [])
        # The watermark replays from the FROZEN snapshot string (D3 —
        # which-string, byte-for-byte): paid exports carry None (absent) and
        # never gain watermark rows; free exports always replay the string
        # they were charged for, even if the copy later edits.
        content = build_export_file(
            export_row.format,
            rows,
            headers,
            watermark_text=export_row.rows_json.get('watermark'),
        )
        return FileResponse(
            io.BytesIO(content),
            content_type=export_mime(export_row.format),
            as_attachment=True,
            filename=f'dzleads-export-{export_row.id}.{export_row.format}',
        )
