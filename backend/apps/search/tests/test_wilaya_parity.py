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
            if f'export const {array_name}' in line and '= [' in line
        ),
        None,
    )
    assert start is not None, f'{path.name}: export const {array_name} array not found'
    rows: list[tuple[str, ...]] = []
    for line in lines[start + 1 :]:
        stripped = line.strip()
        if stripped == ']':
            break
        if not stripped:
            continue
        match = row_re.fullmatch(stripped)
        assert match is not None, f'{path.name}: unparsable row: {stripped}'
        rows.append(match.groups())
    return rows


class TestWilayaParity:
    def test_frontend_wilayas_lockstep_with_backend(self) -> None:
        rows = _parse_ts_array(FRONTEND_DATA / 'wilayas.ts', 'WILAYAS', WILAYA_ROW_RE)
        assert len(rows) == 58
        assert [int(row[0]) for row in rows] == list(range(1, 59))
        backend = {row['code']: row for row in WILAYAS}
        for row in rows:
            code, name_ar, name_fr, name_en = int(row[0]), row[2], row[4], row[6]
            assert name_ar and name_fr and name_en, f'wilaya {code} has a blank name'
            assert code in backend, f'wilaya {code} missing from backend data'
            backend_row = backend[code]
            assert backend_row['name_ar'] == name_ar, f'wilaya {code}: name_ar drift'
            assert backend_row['name_fr'] == name_fr, f'wilaya {code}: name_fr drift'
            assert backend_row['name_en'] == name_en, f'wilaya {code}: name_en drift'


class TestIndustryParity:
    def test_frontend_industries_lockstep_with_backend(self) -> None:
        rows = _parse_ts_array(FRONTEND_DATA / 'industries.ts', 'INDUSTRIES', INDUSTRY_ROW_RE)
        assert len(rows) == len(INDUSTRIES)
        assert [int(row[0]) for row in rows] == list(range(1, len(rows) + 1))
        for row in rows:
            assert row[2] and row[4] and row[6], f'industry {row[0]} has a blank name'
        assert [row[6] for row in rows] == [
            industry['name_en'] for industry in INDUSTRIES
        ], 'name_en order drifted from the backend seed order (seed order = serial ids)'
