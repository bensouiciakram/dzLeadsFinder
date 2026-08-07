"""CSV + xlsx file generation for exports (FR-17/18).

Stdlib only (NO new dependencies — openpyxl is NOT approved): `csv` for the
CSV writer (BOM + CRLF + RFC-4180, the 4.3 client-CSV rules applied
server-side) and a hand-rolled minimal xlsx package via `zipfile` + XML
(inline strings so phone numbers stay text, explicit `t="n"` numeric cells,
per FR-18's opens-cleanly / no-auto-coercion contract).

Both builders are locale-agnostic: the header LABELS are injected (the
4.3 labels-injected builder precedent); data values pass through verbatim
(FR-3 — only headers localize).
"""

import csv
import io
import re
import xml.sax.saxutils
import zipfile
from typing import Any

_XLSX_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
_REL_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
_CT_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/content-types'
_PKG_REL_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships'

# C0 control characters are illegal in XML 1.0 (0x00-0x08, 0x0B, 0x0C,
# 0x0E-0x1F): scraped lead data can contain them, and a single one would
# produce an xlsx Excel/LibreOffice refuse to open ("repair" prompt).
_CONTROL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')

# CSV formula-injection guard (OWASP): cells beginning with a formula
# trigger character are evaluated by Excel on open — scraped web data is an
# untrusted injection surface. Neutralize by prefixing a single quote.
_FORMULA_TRIGGER_RE = re.compile(r'^[=+\-@]')


def build_export_csv(rows: list[dict[str, Any]], headers: dict[str, str]) -> bytes:
    """Serialize export rows to CSV bytes: UTF-8 BOM, CRLF, RFC-4180.

    `headers` maps the column keys (in stable order) to their localized
    labels. Missing values serialize as blank cells — the CSV columns are
    always stable (FR-2). Cells are sanitized: C0 control characters are
    stripped and formula-trigger prefixes are neutralized (Excel safety).
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator='\r\n')
    writer.writerow(list(headers.values()))
    for row in rows:
        writer.writerow([_cell(row.get(key)) for key in headers])
    return ('\ufeff' + buffer.getvalue()).encode('utf-8')


def _sanitize_text(value: str) -> str:
    value = _CONTROL_RE.sub('', value)
    if _FORMULA_TRIGGER_RE.match(value):
        return "'" + value
    return value


def _cell(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    return _sanitize_text(str(value))


def _column_letter(index: int) -> str:
    letter = ''
    number = index + 1
    while number:
        number, remainder = divmod(number - 1, 26)
        letter = chr(65 + remainder) + letter
    return letter


def _xml_escape(value: str) -> str:
    value = _CONTROL_RE.sub('', value)
    return xml.sax.saxutils.escape(value, {'"': '&quot;'})


def build_export_xlsx(rows: list[dict[str, Any]], headers: dict[str, str]) -> bytes:
    """Serialize export rows to a minimal xlsx package (stdlib zipfile).

    Text cells (incl. phone numbers) are inline strings (`t="inlineStr"`) so
    Excel/LibreOffice never auto-coerce them to numbers (FR-18); int values
    (people_count) are explicit numeric cells (`t="n"`).
    """
    sheet_rows: list[str] = []
    sheet_rows.append(_xml_escape(_header_row(headers)))
    row_number = 2
    for row in rows:
        cells = []
        for index, key in enumerate(headers):
            value = row.get(key)
            ref = f'{_column_letter(index)}{row_number}'
            if isinstance(value, int) and not isinstance(value, bool):
                cells.append(f'<c r="{ref}" t="n"><v>{value}</v></c>')
            else:
                text = _xml_escape(_cell(value))
                cells.append(
                    f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'
                )
        sheet_rows.append('<row>' + ''.join(cells) + '</row>')
        row_number += 1
    sheet_data = '<sheetData>' + ''.join(sheet_rows) + '</sheetData>'

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Types xmlns="{_CT_NAMESPACE}">'
        '<Default Extension="rels" ContentType='
        '"application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType='
        '"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType='
        '"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType='
        '"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '</Types>'
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Relationships xmlns="{_PKG_REL_NAMESPACE}">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
        'relationships/officeDocument" Target="xl/workbook.xml"/>'
        '</Relationships>'
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<workbook xmlns="{_XLSX_NAMESPACE}" xmlns:r="{_REL_NAMESPACE}">'
        '<sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets>'
        '</workbook>'
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Relationships xmlns="{_PKG_REL_NAMESPACE}">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/'
        'officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/'
        'officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '</Relationships>'
    )
    worksheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<worksheet xmlns="{_XLSX_NAMESPACE}" xmlns:r="{_REL_NAMESPACE}">'
        f'{sheet_data}'
        '</worksheet>'
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<styleSheet xmlns="{_XLSX_NAMESPACE}">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" '
        'borderId="0"/></cellStyleXfs>'
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" '
        'borderId="0" xfId="0"/></cellXfs>'
        '</styleSheet>'
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', content_types)
        archive.writestr('_rels/.rels', root_rels)
        archive.writestr('xl/workbook.xml', workbook)
        archive.writestr('xl/_rels/workbook.xml.rels', workbook_rels)
        archive.writestr('xl/worksheets/sheet1.xml', worksheet)
        archive.writestr('xl/styles.xml', styles)
    return buffer.getvalue()


def _header_row(headers: dict[str, str]) -> str:
    cells = [
        f'<c r="{_column_letter(index)}1" t="inlineStr"><is><t>{_xml_escape(label)}</t></is></c>'
        for index, label in enumerate(headers.values())
    ]
    return '<row>' + ''.join(cells) + '</row>'
