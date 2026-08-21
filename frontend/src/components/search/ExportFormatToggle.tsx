'use client'

import { useTranslations } from 'next-intl'

import type { ExportFormat } from '@/lib/api/export-service'

const FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel .xlsx',
}

type ExportFormatToggleProps = {
  format: ExportFormat
  freeTier: boolean
  // The upgrade-dialog side effect for a free-tier xlsx click lives in the
  // parent (it must close the host modal first — stack-depth-1).
  onSelect: (next: ExportFormat) => void
}

export function ExportFormatToggle({ format, freeTier, onSelect }: ExportFormatToggleProps) {
  const t = useTranslations()
  return (
    <>
      <div className="flex gap-3">
        <button
          type="button"
          aria-pressed={format === 'csv'}
          onClick={() => onSelect('csv')}
          className={`min-h-10 flex-1 rounded-md border px-4 text-small font-medium ${
            format === 'csv'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground'
          }`}
        >
          {FORMAT_LABEL.csv}
        </button>
        <button
          type="button"
          aria-pressed={format === 'xlsx'}
          aria-disabled={freeTier || undefined}
          aria-describedby={freeTier ? 'xlsx-upgrade-note' : undefined}
          onClick={() => onSelect('xlsx')}
          className={`min-h-10 flex-1 rounded-md border px-4 text-small font-medium ${
            format === 'xlsx' && !freeTier
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-strong'
          }`}
        >
          {FORMAT_LABEL.xlsx}
        </button>
      </div>
      {freeTier && (
        <p id="xlsx-upgrade-note" className="text-caption text-muted-foreground">
          {t('export.modal.xlsx_upgrade')}
        </p>
      )}
    </>
  )
}
