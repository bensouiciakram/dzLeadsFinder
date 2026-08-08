"""Pure-function tests for the CSV + xlsx generators (no DB, no client).

The builders are locale-agnostic: header LABELS are injected (the 4.3
labels-injected builder precedent); data values pass through verbatim
(FR-3 — only headers localize).
"""

import csv
import zipfile
from xml.etree import ElementTree

from apps.exports.export_service import build_export_csv, build_export_xlsx
from apps.exports.messages import (
    EXPORT_COMPANY_COLUMNS,
    EXPORT_CSV_HEADERS,
    EXPORT_PEOPLE_COLUMNS,
)

PEOPLE_HEADERS = EXPORT_CSV_HEADERS['en']['people']
COMPANY_HEADERS = EXPORT_CSV_HEADERS['en']['company']

PEOPLE_ROW = {
    'name': 'Amina Bensalem',
    'role': 'Owner',
    'company': 'Studio Ziban',
    'wilaya': 'Oran (31)',
    'email': 'amina@studio.dz',
    'phone': '0550 12 34 56',
    'address': 'Rue Didouche, Oran',
}

COMPANY_ROW = {
    'name': 'Media D’Or',
    'industry': 'Advertising',
    'wilaya': 'Alger (16)',
    'size_band': '11-50',
    'website': 'https://mediador.dz',
    'people_count': 37,
}


def _csv_lines(content: str) -> list[str]:
    return content.rstrip('\r\n').split('\r\n')


class TestCsv:
    def test_bom_prefix(self) -> None:
        data = build_export_csv([PEOPLE_ROW], PEOPLE_HEADERS)
        assert data.startswith('\ufeff'.encode('utf-8'))

    def test_crlf_line_endings(self) -> None:
        data = build_export_csv([PEOPLE_ROW], PEOPLE_HEADERS).decode('utf-8-sig')
        assert '\r\n' in data
        assert '\n' not in data.replace('\r\n', '')

    def test_localized_headers_people(self) -> None:
        fr_headers = EXPORT_CSV_HEADERS['fr']['people']
        data = build_export_csv([], fr_headers).decode('utf-8-sig')
        first_line = _csv_lines(data)[0]
        for label in fr_headers.values():
            assert label in first_line

    def test_localized_headers_company(self) -> None:
        ar_headers = EXPORT_CSV_HEADERS['ar']['company']
        data = build_export_csv([], ar_headers).decode('utf-8-sig')
        first_line = _csv_lines(data)[0]
        for label in ar_headers.values():
            assert label in first_line

    def test_people_column_order_stable(self) -> None:
        data = build_export_csv([], PEOPLE_HEADERS).decode('utf-8-sig')
        header = _csv_lines(data)[0]
        labels = [label for label in PEOPLE_HEADERS.values()]
        assert header.split(',') == labels

    def test_company_column_order_stable(self) -> None:
        data = build_export_csv([], COMPANY_HEADERS).decode('utf-8-sig')
        header = _csv_lines(data)[0]
        labels = [label for label in COMPANY_HEADERS.values()]
        assert header.split(',') == labels

    def test_row_values_in_column_order(self) -> None:
        data = build_export_csv([PEOPLE_ROW], PEOPLE_HEADERS).decode('utf-8-sig')
        lines = _csv_lines(data)
        assert len(lines) == 2
        values = next(csv.reader([lines[1]]))
        assert values == [
            'Amina Bensalem',
            'Owner',
            'Studio Ziban',
            'Oran (31)',
            'amina@studio.dz',
            '0550 12 34 56',
            'Rue Didouche, Oran',
        ]

    def test_wilaya_cell_localized_name_and_code(self) -> None:
        assert PEOPLE_ROW['wilaya'] == 'Oran (31)'
        data = build_export_csv([PEOPLE_ROW], PEOPLE_HEADERS).decode('utf-8-sig')
        assert 'Oran (31)' in _csv_lines(data)[1]

    def test_rfc4180_escaping(self) -> None:
        row = dict(PEOPLE_ROW)
        row['address'] = 'Rue "X", Oran\nSecond line'
        data = build_export_csv([row], PEOPLE_HEADERS).decode('utf-8-sig')
        assert '"Rue ""X"", Oran' in data
        assert 'Second line' in data

    def test_data_values_never_translated(self) -> None:
        ar_headers = EXPORT_CSV_HEADERS['ar']['people']
        data = build_export_csv([PEOPLE_ROW], ar_headers).decode('utf-8-sig')
        lines = _csv_lines(data)
        assert lines[0].startswith(ar_headers['name'])
        assert lines[1].startswith('Amina Bensalem')

    def test_empty_export_headers_only(self) -> None:
        data = build_export_csv([], PEOPLE_HEADERS).decode('utf-8-sig')
        assert len(_csv_lines(data)) == 1

    def test_empty_cells_serialize_blank(self) -> None:
        row = {
            'name': 'Only Name',
            'role': None,
            'company': None,
            'wilaya': None,
            'email': None,
            'phone': None,
            'address': None,
        }
        data = build_export_csv([row], PEOPLE_HEADERS).decode('utf-8-sig')
        values = next(csv.reader([_csv_lines(data)[1]]))
        assert values == ['Only Name', '', '', '', '', '', '']

    def test_formula_injection_neutralized(self) -> None:
        row = {
            'name': '=HYPERLINK("http://evil.dz","click")',
            'role': '+SUM(1,1)',
            'company': '-2+3',
            'wilaya': '@cmd',
            'email': 'ok@mail.dz',
            'phone': '0550 00 00 00',
            'address': 'plain',
        }
        data = build_export_csv([row], PEOPLE_HEADERS).decode('utf-8-sig')
        values = next(csv.reader([_csv_lines(data)[1]]))
        assert values[0].startswith("'=")
        assert values[1].startswith("'+")
        assert values[2].startswith("'-")
        assert values[3].startswith("'@")
        assert values[4] == 'ok@mail.dz'
        assert values[5] == '0550 00 00 00'

    def test_control_characters_stripped_from_csv(self) -> None:
        row = dict(PEOPLE_ROW)
        row['name'] = 'Bad\x00Name\x0bX'
        data = build_export_csv([row], PEOPLE_HEADERS).decode('utf-8-sig')
        assert 'BadNameX' in data
        assert '\x00' not in data

    def test_people_column_keys_pinned(self) -> None:
        assert EXPORT_PEOPLE_COLUMNS == [
            'name',
            'role',
            'company',
            'wilaya',
            'email',
            'phone',
            'address',
        ]

    def test_company_column_keys_pinned(self) -> None:
        assert EXPORT_COMPANY_COLUMNS == [
            'name',
            'industry',
            'wilaya',
            'size_band',
            'website',
            'people_count',
        ]


class TestCsvWatermark:
    def test_watermark_layout_header_footer(self) -> None:
        """FR-19 file shape: watermark header row → column header row → data
        rows → watermark footer row (literal content rows, not overlays)."""
        data = build_export_csv(
            [PEOPLE_ROW, PEOPLE_ROW], PEOPLE_HEADERS, watermark_text='WATER'
        ).decode('utf-8-sig')
        lines = _csv_lines(data)
        assert lines[0] == 'WATER'
        assert lines[1] == ','.join(PEOPLE_HEADERS.values())
        assert len(lines[2]) > 0 and len(lines[3]) > 0
        assert lines[-1] == 'WATER'
        assert len(lines) == 5

    def test_watermark_rows_single_cell(self) -> None:
        """The watermark row is ONE cell (no column padding) — RFC-4180
        quoting only when the string needs it."""
        data = build_export_csv(
            [], PEOPLE_HEADERS, watermark_text='WATER'
        ).decode('utf-8-sig')
        lines = _csv_lines(data)
        assert lines[0] == 'WATER'
        assert lines[-1] == 'WATER'

    def test_watermark_none_byte_identical(self) -> None:
        """Legacy paid output unchanged: the default (and explicit None)
        produce byte-identical files with no watermark."""
        default = build_export_csv([PEOPLE_ROW], PEOPLE_HEADERS)
        explicit = build_export_csv([PEOPLE_ROW], PEOPLE_HEADERS, None)
        assert default == explicit
        text = default.decode('utf-8-sig')
        lines = _csv_lines(text)
        assert len(lines) == 2  # header + data row — no watermark lines

    def test_watermark_string_injected_verbatim(self) -> None:
        """The builder never localizes and never flags: the passed string
        appears EXACTLY (em-dash + Arabic) in the output."""
        arabic = 'DZLeads Free — قم بالترقية لإزالة العلامة المائية'
        data = build_export_csv(
            [PEOPLE_ROW], PEOPLE_HEADERS, watermark_text=arabic
        ).decode('utf-8-sig')
        lines = _csv_lines(data)
        assert lines[0] == arabic
        assert lines[-1] == arabic

    def test_watermark_rows_never_counted(self) -> None:
        """The watermark adds exactly 2 lines; data-row counts never change
        (row_count/credits derive over the DATA set only — D5/4.6)."""
        data = build_export_csv(
            [PEOPLE_ROW, PEOPLE_ROW, PEOPLE_ROW], PEOPLE_HEADERS, watermark_text='W'
        ).decode('utf-8-sig')
        lines = _csv_lines(data)
        assert len(lines) == 6  # 1 wm header + 1 column header + 3 data + 1 wm footer
        assert lines.count('W') == 2

    def test_watermark_cell_rfc4180_quoted(self) -> None:
        """The watermark row is a single cell — RFC-4180 quoting applies when
        the string needs it (comma / quote), never for plain strings."""
        tricky = 'DZLeads Free, "upgrade"'
        data = build_export_csv([], PEOPLE_HEADERS, watermark_text=tricky).decode('utf-8-sig')
        lines = _csv_lines(data)
        assert lines[0] == '"DZLeads Free, ""upgrade"""'
        assert lines[-1] == '"DZLeads Free, ""upgrade"""'

    def test_watermark_cell_sanitized_like_data_cells(self) -> None:
        """The Excel-safety contract holds for the watermark cell too: C0
        control chars stripped, formula-trigger prefixes neutralized."""
        raw = build_export_csv([], PEOPLE_HEADERS, watermark_text='=EVIL\x00\x0b')
        text = raw.decode('utf-8-sig')
        lines = _csv_lines(text)
        assert lines[0] == "'=EVIL"
        assert '\x00' not in text

    def test_watermark_empty_string_means_no_watermark(self) -> None:
        """'' behaves like None (no watermark rows) — never blank rows."""
        empty = build_export_csv([PEOPLE_ROW], PEOPLE_HEADERS, watermark_text='')
        none_ = build_export_csv([PEOPLE_ROW], PEOPLE_HEADERS, watermark_text=None)
        assert empty == none_


def _xlsx_parts(data: bytes) -> dict[str, bytes]:
    import io

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        return {name: zf.read(name) for name in zf.namelist()}


def _parse_xml(data: bytes) -> ElementTree.Element:
    return ElementTree.fromstring(data)


class TestXlsx:
    REQUIRED_PARTS = {
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/worksheets/sheet1.xml',
        'xl/styles.xml',
    }

    def test_package_parts_present(self) -> None:
        parts = _xlsx_parts(build_export_xlsx([PEOPLE_ROW], PEOPLE_HEADERS))
        assert self.REQUIRED_PARTS <= set(parts)

    def test_all_xml_well_formed(self) -> None:
        parts = _xlsx_parts(build_export_xlsx([PEOPLE_ROW], PEOPLE_HEADERS))
        for name, content in parts.items():
            if name.endswith('.xml') or name.endswith('.rels'):
                _parse_xml(content)

    def test_header_row_localized(self) -> None:
        fr_headers = EXPORT_CSV_HEADERS['fr']['people']
        data = build_export_xlsx([PEOPLE_ROW], fr_headers)
        sheet = _xlsx_parts(data)['xl/worksheets/sheet1.xml'].decode('utf-8')
        for label in fr_headers.values():
            assert label in sheet

    def test_phone_preserved_as_text(self) -> None:
        data = build_export_xlsx([PEOPLE_ROW], PEOPLE_HEADERS)
        sheet = _xlsx_parts(data)['xl/worksheets/sheet1.xml'].decode('utf-8')
        assert '0550 12 34 56' in sheet
        assert sheet.count('t="inlineStr"') > 0

    def test_numeric_cell_explicit(self) -> None:
        data = build_export_xlsx([COMPANY_ROW], COMPANY_HEADERS)
        sheet = _xlsx_parts(data)['xl/worksheets/sheet1.xml'].decode('utf-8')
        assert '<v>37</v>' in sheet

    def test_phone_round_trip_through_parsed_xml(self) -> None:
        data = build_export_xlsx([PEOPLE_ROW], PEOPLE_HEADERS)
        sheet = _parse_xml(_xlsx_parts(data)['xl/worksheets/sheet1.xml'])
        text_cells = [
            elem.text or ''
            for elem in sheet.iter()
            if elem.tag.endswith('t') and elem.text
        ]
        assert '0550 12 34 56' in text_cells
        assert 'Amina Bensalem' in text_cells
        assert 'Oran (31)' in text_cells

    def test_company_people_count_numeric_not_text(self) -> None:
        data = build_export_xlsx([COMPANY_ROW], COMPANY_HEADERS)
        sheet = _xlsx_parts(data)['xl/worksheets/sheet1.xml'].decode('utf-8')
        assert '<v>37</v>' in sheet

    def test_workbook_declares_export_sheet(self) -> None:
        data = build_export_xlsx([PEOPLE_ROW], PEOPLE_HEADERS)
        workbook = _xlsx_parts(data)['xl/workbook.xml'].decode('utf-8')
        assert 'sheet name="Export"' in workbook

    def test_control_characters_stripped_from_xlsx(self) -> None:
        row = dict(PEOPLE_ROW)
        row['name'] = 'Bad\x00Name\x0bX'
        row['address'] = 'Ctrl\x0cchar'
        data = build_export_xlsx([row], PEOPLE_HEADERS)
        sheet = _xlsx_parts(data)['xl/worksheets/sheet1.xml'].decode('utf-8')
        assert 'BadNameX' in sheet
        assert 'Ctrlchar' in sheet
        assert '\x00' not in sheet
        _parse_xml(_xlsx_parts(data)['xl/worksheets/sheet1.xml'])
