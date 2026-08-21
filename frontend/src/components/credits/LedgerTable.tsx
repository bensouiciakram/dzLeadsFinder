'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { LedgerRow } from '@/lib/api/credits-service'

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

type LedgerTableProps = {
  rows: LedgerRow[]
  typeLabels: Record<string, string>
}

export function LedgerTable({ rows, typeLabels }: LedgerTableProps) {
  const t = useTranslations()
  const locale = useLocale()
  return (
    /* table-fixed + explicit widths: auto layout stretches the columns
        proportionally and the /credits cells carry no horizontal padding,
        so compressed columns run together ("Balance afterReference" —
        deferred-work manual-testing finding). */
    <table data-testid="ledger-table" className="w-full min-w-[640px] table-fixed border-collapse text-small">
      <thead>
        <tr className="text-small font-semibold text-muted-foreground">
          <th scope="col" className="w-[30%] border-b border-border px-3 py-3 text-start font-semibold">
            {t('common.credits.column_type')}
          </th>
          <th scope="col" className="w-[12%] border-b border-border px-3 py-3 text-end font-semibold">
            {t('common.credits.column_amount')}
          </th>
          <th scope="col" className="w-[22%] border-b border-border px-3 py-3 text-start font-semibold">
            {t('common.credits.column_date')}
          </th>
          <th scope="col" className="w-[14%] border-b border-border px-3 py-3 text-end font-semibold">
            {t('common.credits.column_balance_after')}
          </th>
          <th scope="col" className="w-[22%] border-b border-border px-3 py-3 text-start font-semibold">
            {t('common.credits.column_reference')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border hover:bg-muted">
            <td className="px-3 py-3 text-start">{typeLabels[row.event_type] ?? row.event_type}</td>
            <td className="whitespace-nowrap px-3 py-3 text-end tabular-nums">
              {row.amount > 0 ? `+${row.amount}` : String(row.amount)}
            </td>
            <td className="px-3 py-3 text-start">
              <bdi className="tabular-nums">{formatTimestamp(row.created_at, locale)}</bdi>
            </td>
            <td className="whitespace-nowrap px-3 py-3 text-end tabular-nums">
              {String(row.balance_after)}
            </td>
            <td
              className="truncate px-3 py-3 text-start font-mono text-caption text-muted-foreground"
              title={row.reference_id ?? undefined}
            >
              {row.reference_id ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
