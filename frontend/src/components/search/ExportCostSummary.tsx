'use client'

import { useTranslations } from 'next-intl'

type ExportCostSummaryProps = {
  freeTier: boolean
  loading: boolean
  totalRows: number | null
  revealedCount: number
  includedUnrevealed: number
  cost: number
  balanceAfter: number | null
}

export function ExportCostSummary({
  freeTier,
  loading,
  totalRows,
  revealedCount,
  includedUnrevealed,
  cost,
  balanceAfter,
}: ExportCostSummaryProps) {
  const t = useTranslations()
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border pb-1.5">
      <span className="text-small text-muted-foreground">
        {t(freeTier ? 'export.modal.rows_capped' : 'export.modal.rows')}
      </span>
      <span className="text-data tabular-nums">{loading ? '…' : String(totalRows)}</span>
      <span className="text-small text-muted-foreground">
        {t('export.modal.balance_after')}
      </span>
      <span className="text-data tabular-nums">
        {balanceAfter === null ? '—' : String(balanceAfter)}
      </span>
      {loading ? (
        <span className="w-full text-caption text-muted-foreground">
          {t('export.modal.calculating')}
        </span>
      ) : (
        <span className="w-full text-caption tabular-nums text-muted-foreground">
          {t('export.modal.cost_breakdown', {
            revealed: String(revealedCount),
            unrevealed: String(includedUnrevealed),
            total: String(cost),
          })}
        </span>
      )}
    </div>
  )
}
