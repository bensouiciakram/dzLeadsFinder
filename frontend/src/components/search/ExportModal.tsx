'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from '@/components/providers/ToastProvider'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useExport } from '@/hooks/useExport'
import { useExportPreview } from '@/hooks/useExportPreview'
import type { ExportFormat } from '@/lib/api/export-service'
import { navigator } from '@/lib/api/http-client'
import type { SearchTab } from '@/lib/api/search-service'

export type ExportModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: SearchTab
  filtersJson: string
  sort: string
  nonce: number
  total: number
  tier: 'free' | 'starter'
  balance: number | null
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel .xlsx',
}

function wilayaLabel(name: string | null, code: number | null): string {
  if (name === null && code === null) return ''
  if (name === null) return String(code)
  if (code === null) return name
  return `${name} (${code})`
}

export function ExportModal({
  open,
  onOpenChange,
  tab,
  filtersJson,
  sort,
  nonce,
  total,
  tier,
  balance,
}: ExportModalProps) {
  const t = useTranslations()
  const { toast } = useToast()
  const [includeUnrevealed, setIncludeUnrevealed] = useState(true)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const regionRef = useRef<HTMLDivElement>(null)

  const { preview, isCollecting, error: previewError, retry } = useExportPreview({
    open,
    tab,
    filtersJson,
    sort,
    nonce,
    total,
    tier,
  })
  const { create, isPending, error: mutationError, reset } = useExport({
    onSuccess: (result) => {
      onOpenChange(false)
      navigator.assign(`/api/export/${result.id}/download/`)
    },
  })

  const freeTier = tier === 'free'

  useEffect(() => {
    if (mutationError === 'starter') {
      toast('billing.upgrade_stub')
    }
  }, [mutationError, toast])

  // On every open the form returns to its AC-pinned defaults and the mutation
  // error state is cleared — a 429 from yesterday must not block today's
  // attempt, and a 409/402 user must never be stuck (review patches H-A3/L8).
  useEffect(() => {
    if (open) {
      setIncludeUnrevealed(true)
      setFormat('csv')
      reset()
    }
  }, [open, reset])

  const ids = useMemo(() => {
    if (preview === null) return []
    if (includeUnrevealed) return preview.ids
    return preview.rows.filter((row) => row.revealed).map((row) => row.id)
  }, [preview, includeUnrevealed])

  const cost = includeUnrevealed ? (preview?.totalRows ?? 0) : (preview?.revealedCount ?? 0)
  const insufficient = balance !== null && balance < cost
  const confirmLocked =
    freeTier ||
    insufficient ||
    balance === null ||
    preview === null ||
    preview.totalRows === 0 ||
    ids.length === 0 ||
    isPending
  const balanceAfter = balance === null ? null : balance - cost

  const regionError =
    mutationError === 'limit' ||
    mutationError === 'credits' ||
    mutationError === 'concurrent' ||
    mutationError === 'generic'
      ? mutationError
      : undefined

  useEffect(() => {
    if (regionError !== undefined) {
      regionRef.current?.focus()
    }
  }, [regionError])

  const handleConfirm = () => {
    if (freeTier) {
      toast('billing.upgrade_stub')
      return
    }
    if (insufficient) {
      toast('common.credits.no_credits')
      return
    }
    if (confirmLocked) return
    create({ record_ids: ids, format, include_unrevealed: includeUnrevealed })
  }

  const handleRetry = () => {
    if (preview === null || preview.totalRows === 0 || ids.length === 0) return
    create({ record_ids: ids, format, include_unrevealed: includeUnrevealed })
  }

  const handleFormatClick = (next: ExportFormat) => {
    if (freeTier && next === 'xlsx') {
      toast('billing.upgrade_stub')
      return
    }
    setFormat(next)
  }

  const previewLines = useMemo(() => {
    if (preview === null) return null
    const header =
      tab === 'people'
        ? [
            t('export.modal.header_name'),
            t('export.modal.header_role'),
            t('export.modal.header_company'),
            t('export.modal.header_wilaya'),
          ]
        : [
            t('export.modal.header_name'),
            t('export.modal.header_industry'),
            t('export.modal.header_wilaya'),
            t('export.modal.header_people_count'),
          ]
    const body = preview.rows.slice(0, 2).map((row) => {
      const wilaya = wilayaLabel(row.wilaya_name, row.wilaya_code)
      const cells =
        tab === 'people'
          ? [row.name, row.role ?? '', row.company_name ?? '', wilaya]
          : [row.name, row.industry ?? '', wilaya, String(row.people_count)]
      return { key: row.id, text: cells.join(',') }
    })
    return { header: header.join(','), body }
  }, [preview, tab, t])

  const regionClassName =
    'rounded-md border border-border bg-muted/50 p-4 text-small text-muted-strong focus:outline-none'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-title">
            {t(freeTier ? 'export.modal.title_free' : 'export.modal.title')}
          </DialogTitle>
        </DialogHeader>

        {regionError === 'limit' ? (
          <div ref={regionRef} tabIndex={-1} role="status" className={regionClassName}>
            {t('export.modal.come_back_tomorrow')}
          </div>
        ) : regionError === 'credits' ? (
          <div ref={regionRef} tabIndex={-1} role="alert" className={regionClassName}>
            {t('export.modal.error_credits')}
          </div>
        ) : regionError === 'concurrent' ? (
          <div ref={regionRef} tabIndex={-1} role="alert" className={regionClassName}>
            <p>{t('export.modal.error_concurrent')}</p>
            <button
              type="button"
              className="mt-3 min-h-11 rounded-md border border-border bg-card px-4 text-small text-muted-strong md:min-h-10"
              onClick={handleRetry}
            >
              {t('search.results.retry')}
            </button>
          </div>
        ) : regionError === 'generic' ? (
          <div ref={regionRef} tabIndex={-1} role="alert" className={regionClassName}>
            <p>{t('export.modal.error_generic')}</p>
            <button
              type="button"
              className="mt-3 min-h-11 rounded-md border border-border bg-card px-4 text-small text-muted-strong md:min-h-10"
              onClick={handleRetry}
            >
              {t('search.results.retry')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
              <span className="text-small text-muted-foreground">
                {t(freeTier ? 'export.modal.rows_capped' : 'export.modal.rows')}
              </span>
              <span className="text-data tabular-nums">
                {isCollecting || preview === null ? '…' : String(preview.totalRows)}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
              {isCollecting || preview === null ? (
                <>
                  <span className="text-small text-muted-foreground">
                    {t('export.modal.calculating')}
                  </span>
                  <span className="text-data tabular-nums">…</span>
                </>
              ) : (
                <p className="text-data tabular-nums">
                  {t('export.modal.cost_breakdown', {
                    revealed: String(preview.revealedCount),
                    unrevealed: String(includeUnrevealed ? preview.unrevealedCount : 0),
                    total: String(cost),
                  })}
                </p>
              )}
            </div>

            <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
              <span className="text-small text-muted-foreground">
                {t('export.modal.balance_after')}
              </span>
              <span className="text-data tabular-nums">
                {balanceAfter === null ? '—' : String(balanceAfter)}
              </span>
            </div>

            <label className="flex min-h-11 items-center gap-2 text-small md:min-h-10">
              <input
                type="checkbox"
                checked={includeUnrevealed}
                onChange={(event) => setIncludeUnrevealed(event.target.checked)}
                className="size-4 rounded-sm border border-input"
              />
              <span>{t('export.modal.include_unrevealed')}</span>
            </label>

            <div className="flex flex-col gap-2">
              <p className="text-small text-muted-foreground">
                {t('export.modal.preview_notice')}
              </p>
              <div
                dir="ltr"
                role="group"
                aria-label={t('export.modal.preview_label')}
                className="max-h-40 overflow-y-auto rounded-md bg-muted p-3 text-small leading-6 text-muted-strong"
              >
                {freeTier && <p className="font-semibold text-danger">{t('export.watermark')}</p>}
                <p>{previewLines?.header}</p>
                {previewLines?.body.map((line) => (
                  <p key={line.key} className="truncate">
                    {line.text}
                  </p>
                ))}
                {(preview?.totalRows ?? 0) > 2 && <p>…</p>}
                {freeTier && <p className="font-semibold text-danger">{t('export.watermark')}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-pressed={format === 'csv'}
                  onClick={() => handleFormatClick('csv')}
                  className={`min-h-11 flex-1 rounded-md border px-4 text-small font-medium md:min-h-10 ${
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
                  onClick={() => handleFormatClick('xlsx')}
                  className={`min-h-11 flex-1 rounded-md border px-4 text-small font-medium md:min-h-10 ${
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
              {insufficient && !freeTier && balance !== null && (
                <p id="export-insufficient-note" className="text-caption text-muted-foreground">
                  {t('export.modal.insufficient')}
                </p>
              )}
              {previewError !== null && (
                <p className="text-caption text-danger">
                  {t('export.modal.preview_error')}{' '}
                  <button type="button" className="underline" onClick={retry}>
                    {t('search.results.retry')}
                  </button>
                </p>
              )}
              <button
                type="button"
                aria-busy={isPending || undefined}
                aria-disabled={confirmLocked || undefined}
                aria-describedby={
                  insufficient && !freeTier && balance !== null
                    ? 'export-insufficient-note'
                    : undefined
                }
                onClick={handleConfirm}
                className={`min-h-11 w-full min-w-[10rem] rounded-md px-4 text-small font-semibold md:min-h-10 ${
                  freeTier ||
                  insufficient ||
                  balance === null ||
                  preview === null ||
                  preview.totalRows === 0 ||
                  ids.length === 0
                    ? 'border border-border bg-muted text-muted-strong'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {isPending ? (
                  <>
                    <Loader2 className="me-2 inline size-4 animate-spin" aria-hidden="true" />
                    <span className="sr-only">{t('common.credits.exporting')}</span>
                    <span aria-hidden="true">
                      {t('export.modal.confirm', { count: String(cost) })}
                    </span>
                  </>
                ) : (
                  t('export.modal.confirm', { count: String(cost) })
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
