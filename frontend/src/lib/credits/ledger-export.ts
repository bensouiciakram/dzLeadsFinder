import type { LedgerResult, LedgerRow } from '@/lib/api/credits-service'

// Mirrors the backend ledger page size — the walker's stop condition
// ("a short page means the last page") depends on this exact number.
export const LEDGER_PAGE_SIZE = 50

export type LedgerCollection =
  | { ok: true; rows: LedgerRow[] }
  | { ok: false; reason: 'shrank' | 'failed' }

// Completeness: the CSV covers the FULL 90-day window, so every page is
// fetched on demand (never on mount — NFR-1 headroom).
export async function collectAllLedgerRows(
  fetchPage: (page: number) => Promise<LedgerResult>,
): Promise<LedgerCollection> {
  try {
    const allRows: LedgerRow[] = []
    const seen = new Set<string>()
    let lastTotal = 0
    for (let currentPage = 1; ; currentPage += 1) {
      const result = await fetchPage(currentPage)
      lastTotal = result.total
      for (const row of result.results) {
        // Offset-pagination drift: a grant/reveal landing between page
        // fetches shifts offsets, so a row can appear on two pages.
        // Dedupe by id — the window export must contain each row once.
        if (!seen.has(row.id)) {
          seen.add(row.id)
          allRows.push(row)
        }
      }
      if (
        result.results.length === 0 ||
        result.results.length < LEDGER_PAGE_SIZE ||
        allRows.length >= result.total
      ) {
        break
      }
    }
    if (allRows.length < lastTotal) {
      // The ledger shrank mid-export (rows rolled out of the 90-day
      // window) — refuse rather than export a partial loop.
      return { ok: false, reason: 'shrank' }
    }
    return { ok: true, rows: allRows }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
