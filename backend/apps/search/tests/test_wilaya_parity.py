"""Cross-stack data parity tests (Story 3.4).

frontend/src/data/wilayas.ts and frontend/src/data/industries.ts are the
canonical sources; backend/apps/search/data/wilayas.py and
backend/apps/search/data/industries.py are verified mirrors.

Deferred-work 3.4-OWNED: replaces the dev-run-only parity note with a real
automated check (also covers the 3.3 industries extension).
"""

import re
from pathlib import Path

from apps.search.data.industries import INDUSTRIES
from apps.search.data.wilayas import WILAYAS

FRONTEND_DATA = Path(__file__).resolve().parents[4] / 'frontend' / 'src' / 'data'

WILAYA_ROW_RE = re.compile(
    r"\{ code: (\d+), name_ar: (['\"])(.*?)\2, name_fr: (['\"])(.*?)\4, "
    r"name_en: (['\"])(.*?)\6 \}(,)?$"
)
INDUSTRY_ROW_RE = re.compile(
    r"\{ id: (\d+), name_ar: (['\"])(.*?)\2, name_fr: (['\"])(.*?)\4, "
    r"name_en: (['\"])(.*?)\6 \}(,)?$"
)


def _parse_ts_array(path: Path, array_name: str, row_re: re.Pattern[str]) -> list[tuple[str, ...]]:
    content = path.read_text(encoding='utf-8')
    lines = content.splitlines()
    start = next(
        (
            i
            for i, line in enumerate(lines)
            if line.strip().startswith(f'export const {array_name}:') and '= [' in line
        ),
        None,
    )
    assert start is not None, f'{path.name}: export const {array_name} array not found'
    rows: list[tuple[str, ...]] = []
    closing_index: int | None = None
    for index, line in enumerate(lines[start + 1 :], start=start + 1):
        stripped = line.strip()
        if stripped == ']':
            closing_index = index
            break
        if not stripped:
            continue
        match = row_re.fullmatch(stripped)
        assert match is not None, f'{path.name}: unparsable row: {stripped}'
        rows.append(match.groups())
    assert closing_index is not None, f'{path.name}: {array_name} array never closed with "]"'
    assert all(not line.strip() for line in lines[closing_index + 1 :]), (
        f'{path.name}: unexpected content after the {array_name} closing bracket'
    )
    return rows


class TestWilayaParity:
    def test_frontend_wilayas_lockstep_with_backend(self) -> None:
        rows = _parse_ts_array(FRONTEND_DATA / 'wilayas.ts', 'WILAYAS', WILAYA_ROW_RE)
        assert len(rows) == 58
        frontend_codes = [int(row[0]) for row in rows]
        assert frontend_codes == list(range(1, 59))
        backend_codes = [row['code'] for row in WILAYAS]
        assert len(backend_codes) == len(set(backend_codes)), (
            'backend wilayas.py has duplicate codes'
        )
        assert set(frontend_codes) == set(backend_codes), (
            'frontend and backend wilaya code sets drifted'
        )
        backend = {row['code']: row for row in WILAYAS}
        for row in rows:
            code, name_ar, name_fr, name_en = int(row[0]), row[2], row[4], row[6]
            assert name_ar and name_fr and name_en, f'wilaya {code} has a blank name'
            backend_row = backend[code]
            assert backend_row['name_ar'] == name_ar, f'wilaya {code}: name_ar drift'
            assert backend_row['name_fr'] == name_fr, f'wilaya {code}: name_fr drift'
            assert backend_row['name_en'] == name_en, f'wilaya {code}: name_en drift'


class TestIndustryParity:
    def test_frontend_industries_lockstep_with_backend(self) -> None:
        rows = _parse_ts_array(FRONTEND_DATA / 'industries.ts', 'INDUSTRIES', INDUSTRY_ROW_RE)
        assert len(rows) == len(INDUSTRIES)
        assert [int(row[0]) for row in rows] == list(range(1, len(rows) + 1))
        for index, row in enumerate(rows):
            assert row[2] and row[4] and row[6], f'industry {row[0]} has a blank name'
            backend_row = INDUSTRIES[index]
            assert backend_row['name_ar'] == row[2], f'industry {row[0]}: name_ar drift'
            assert backend_row['name_fr'] == row[4], f'industry {row[0]}: name_fr drift'
            assert backend_row['name_en'] == row[6], (
                f'industry {row[0]}: name_en drift from the backend seed order '
                '(seed order = serial ids)'
            )
