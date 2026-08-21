'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { LedgerTable } from '@/components/credits/LedgerTable'
import { useSession } from '@/components/providers/SessionProvider'
import { PaginationNav } from '@/components/ui/PaginationNav'
import { useCreditsLedger } from '@/hooks/useCreditsLedger'
import { buildCreditsCsv, downloadCreditsCsv, type CreditsCsvLabels } from '@/lib/credits/csv'
import { collectAllLedgerRows, LEDGER_PAGE_SIZE } from '@/lib/credits/ledger-export'
import { creditsService } from '@/lib/api/credits-service'
import { Button } from '@/components/ui/button'

function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE))
}

export function CreditsPage() {
  const t = useTranslations()
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
      const collection = await collectAllLedgerRows((currentPage) =>
        creditsService.ledger(currentPage),
      )
      if (!collection.ok) {
        setExportError(true)
        return
      }
      downloadCreditsCsv(buildCreditsCsv(collection.rows, csvLabels), 'credits-90-days.csv')
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
          <LedgerTable rows={rows} typeLabels={csvLabels.types} />
          {total > LEDGER_PAGE_SIZE && (
            <PaginationNav
              page={page}
              pageCount={totalPages(total)}
              onPage={setPage}
              formatLabel={(current, pages) =>
                t('common.credits.pagination', { current: String(current), total: String(pages) })
              }
              ariaLabel={t('common.credits.pagination', {
                current: String(page),
                total: String(totalPages(total)),
              })}
            />
          )}
        </div>
      )}
    </div>
  )
}
