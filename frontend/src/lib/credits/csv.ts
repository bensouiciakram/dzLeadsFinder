import type { LedgerRow } from '@/lib/api/credits-service'

export type CreditsCsvLabels = {
  type: string
  amount: string
  timestamp: string
  balance_after: string
  reference: string
  types: Record<string, string>
}

const COLUMN_ORDER: ReadonlyArray<'type' | 'amount' | 'timestamp' | 'balance_after' | 'reference'> = [
  'type',
  'amount',
  'timestamp',
  'balance_after',
  'reference',
]

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildCreditsCsv(rows: LedgerRow[], labels: CreditsCsvLabels): string {
  const header = COLUMN_ORDER.map((column) => escapeCell(labels[column])).join(',')
  const body = rows.map((row) =>
    COLUMN_ORDER.map((column) => {
      switch (column) {
        case 'type':
          return escapeCell(labels.types[row.event_type] ?? row.event_type)
        case 'amount':
          return escapeCell(String(row.amount > 0 ? `+${row.amount}` : row.amount))
        case 'timestamp':
          return escapeCell(row.created_at)
        case 'balance_after':
          return escapeCell(String(row.balance_after))
        case 'reference':
          return escapeCell(row.reference_id ?? '')
      }
    }).join(','),
  )
  return '\uFEFF' + [header, ...body].join('\r\n') + '\r\n'
}

export function downloadCreditsCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Deferred revoke: revoking synchronously can cancel the download in some
  // engines before the browser has grabbed the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
