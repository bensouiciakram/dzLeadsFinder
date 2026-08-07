'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeftIcon, ChevronRightIcon, Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSession } from '@/components/providers/SessionProvider'
import { useCreditsLedger } from '@/hooks/useCreditsLedger'
import { buildCreditsCsv, downloadCreditsCsv, type CreditsCsvLabels } from '@/lib/credits/csv'
import { creditsService, type LedgerRow } from '@/lib/api/credits-service'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 50

function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}

function formatTimestamp(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    // '-u-nu-latn' forces Western numerals in every locale (FR-15/AD-8).
    return new Intl.DateTimeFormat(locale + '-u-nu-latn', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return value
  }
}

export function CreditsPage() {
  const t = useTranslations()
  const locale = useLocale()
  const { user } = useSession()
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const exportingRef = useRef(false)
  const { rows, total, phase, refetch } = useCreditsLedger({ user, page })

  // A session change (logout → login as another account) must never keep
  // the previous user's page number.
  const userKey = user?.email ?? null
  useEffect(() => {
    setPage(1)
  }, [userKey])

  const csvLabels = useMemo<CreditsCsvLabels>(
    () => ({
      type: t('common.credits.column_type'),
      amount: t('common.credits.column_amount'),
      timestamp: t('common.credits.column_date'),
      balance_after: t('common.credits.column_balance_after'),
      reference: t('common.credits.column_reference'),
      types: {
        free_signup: t('common.credits.type_free_signup'),
        subscription_grant: t('common.credits.type_subscription_grant'),
        pack_grant: t('common.credits.type_pack_grant'),
        promotional_grant: t('common.credits.type_promotional_grant'),
        reveal_debit: t('common.credits.type_reveal_debit'),
        export_row_debit: t('common.credits.type_export_row_debit'),
        expiry: t('common.credits.type_expiry'),
      },
    }),
    [t],
  )

  const exportCsv = useCallback(async () => {
    if (user === null) return
    // Re-entrancy guard: `disabled` lands after the next render — the ref
    // blocks two rapid clicks from starting two concurrent export loops.
    if (exportingRef.current) return
    exportingRef.current = true
    setExporting(true)
    setExportError(false)
    try {
      // Completeness: the CSV covers the FULL 90-day window, so every page
      // is fetched on demand (never on mount — NFR-1 headroom).
      const allRows: LedgerRow[] = []
      const seen = new Set<string>()
      let lastTotal = 0
      for (let currentPage = 1; ; currentPage += 1) {
        const result = await creditsService.ledger(currentPage)
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
          result.results.length < PAGE_SIZE ||
          allRows.length >= result.total
        ) {
          break
        }
      }
      if (allRows.length < lastTotal) {
        // The ledger shrank mid-export (rows rolled out of the 90-day
        // window) — export what was collected rather than a partial loop.
        setExportError(true)
        return
      }
      downloadCreditsCsv(buildCreditsCsv(allRows, csvLabels), 'credits-90-days.csv')
    } catch {
      setExportError(true)
    } finally {
      exportingRef.current = false
      setExporting(false)
    }
  }, [user, csvLabels])

  if (user === null) {
    return (
      <div data-testid="credits-page" className="mx-auto max-w-content-max-app px-gutter py-6 md:px-gutter-desktop">
        <p className="text-small text-muted-foreground">{t('common.credits.guest')}</p>
        <Link href="/login" className="mt-3 inline-block text-small text-primary underline-offset-4 hover:underline">
          {t('common.nav.login')}
        </Link>
      </div>
    )
  }

  return (
    <div data-testid="credits-page" className="mx-auto max-w-content-max-app px-gutter py-6 md:px-gutter-desktop">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-title font-bold">{t('common.credits.ledger')}</h1>
        <Button
          variant="outline"
          className="min-h-11 md:h-8"
          onClick={() => void exportCsv()}
          disabled={exporting}
          aria-busy={exporting || undefined}
          data-testid="credits-export"
        >
          <Download className="size-4" aria-hidden="true" />
          {exporting ? t('common.credits.exporting') : t('common.credits.export')}
        </Button>
      </div>
      {exportError && (
        <p role="alert" className="mt-2 text-small text-destructive">
          {t('common.states.error')}
        </p>
      )}

      {phase === 'loading' && (
        <div data-testid="credits-loading" aria-busy="true" className="mt-6">
          <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>
        </div>
      )}

      {phase === 'error' && (
        <div role="alert" className="mt-6 rounded-lg border border-border bg-card p-6">
          <p className="text-small">{t('common.states.error')}</p>
          <Button variant="outline" className="mt-3 min-h-11 md:h-8" onClick={refetch}>
            {t('search.results.retry')}
          </Button>
        </div>
      )}

      {phase === 'success' && rows.length === 0 && page === 1 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <p className="text-small text-muted-foreground">{t('common.credits.empty')}</p>
          <Link
            href="/search"
            className="mt-3 inline-block text-small text-primary underline-offset-4 hover:underline"
          >
            {t('common.credits.empty_cta')}
          </Link>
        </div>
      )}

      {phase === 'success' && rows.length === 0 && page > 1 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <p className="text-small text-muted-foreground">{t('common.credits.no_more_pages')}</p>
          <Button
            variant="outline"
            className="mt-3 min-h-11 md:h-8"
            onClick={() => setPage(1)}
          >
            {t('common.credits.back_to_page_one')}
          </Button>
        </div>
      )}

      {phase === 'success' && rows.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table data-testid="ledger-table" className="w-full border-collapse text-small">
            <thead>
              <tr className="text-small font-semibold text-muted-foreground">
                <th scope="col" className="border-b border-border py-3 text-start font-semibold">
                  {t('common.credits.column_type')}
                </th>
                <th scope="col" className="border-b border-border py-3 text-end font-semibold">
                  {t('common.credits.column_amount')}
                </th>
                <th scope="col" className="border-b border-border py-3 text-start font-semibold">
                  {t('common.credits.column_date')}
                </th>
                <th scope="col" className="border-b border-border py-3 text-end font-semibold">
                  {t('common.credits.column_balance_after')}
                </th>
                <th scope="col" className="border-b border-border py-3 text-start font-semibold">
                  {t('common.credits.column_reference')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border hover:bg-muted">
                  <td className="py-3 text-start">
                    {csvLabels.types[row.event_type] ?? row.event_type}
                  </td>
                  <td className="py-3 text-end tabular-nums">
                    {row.amount > 0 ? `+${row.amount}` : String(row.amount)}
                  </td>
                  <td className="py-3 text-start">
                    <bdi className="tabular-nums">{formatTimestamp(row.created_at, locale)}</bdi>
                  </td>
                  <td className="py-3 text-end tabular-nums">{String(row.balance_after)}</td>
                  <td className="py-3 text-start font-mono text-caption text-muted-foreground">
                    {row.reference_id ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > PAGE_SIZE && (
            <nav
              aria-label={t('common.credits.pagination', {
                current: String(page),
                total: String(totalPages(total)),
              })}
              className="mt-4 flex items-center justify-center gap-2"
            >
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="min-h-11 md:h-8"
              >
                <ChevronLeftIcon className="size-4 rtl:rotate-180" />
                {t('search.results.previous')}
              </Button>
              <span aria-current="page" className="text-small text-muted-foreground tabular-nums">
                {t('common.credits.pagination', {
                  current: String(page),
                  total: String(totalPages(total)),
                })}
              </span>
              <Button
                variant="outline"
                disabled={page >= totalPages(total)}
                onClick={() => setPage((current) => current + 1)}
                className="min-h-11 md:h-8"
              >
                {t('common.actions.next')}
                <ChevronRightIcon className="size-4 rtl:rotate-180" />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
