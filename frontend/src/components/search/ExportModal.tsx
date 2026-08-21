'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/providers/ToastProvider'
import { useUpgradeDialog } from '@/components/providers/UpgradeDialogProvider'
import { ExportConfirmButton } from '@/components/search/ExportConfirmButton'
import { ExportCostSummary } from '@/components/search/ExportCostSummary'
import { ExportErrorRegion } from '@/components/search/ExportErrorRegion'
import { ExportFormatToggle } from '@/components/search/ExportFormatToggle'
import { ExportPreviewBox } from '@/components/search/ExportPreviewBox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useExport } from '@/hooks/useExport'
import { useExportPreview } from '@/hooks/useExportPreview'
import type { ExportFormat } from '@/lib/api/export-service'
import { navigator } from '@/lib/api/http-client'
import type { SearchTab } from '@/lib/api/search-service'

type ExportModalProps = {
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
  const { open: openUpgradeDialog } = useUpgradeDialog()
  const [includeUnrevealed, setIncludeUnrevealed] = useState(true)
  const [format, setFormat] = useState<ExportFormat>('csv')

  const { preview, isCollecting, error: previewError, retry } = useExportPreview({
    open,
    tab,
    filtersJson,
    sort,
    nonce,
    total,
    tier,
  })
  const { create, isPending, error: mutationError } = useExport({
    onSuccess: (result) => {
      onOpenChange(false)
      navigator.assign(`/api/export/${result.id}/download/`)
    },
  })

  const freeTier = tier === 'free'

  useEffect(() => {
    // 5.7 re-point (John V8): the 402/409 starter-only error opens the
    // single Upgrade Dialog — the modal closes first (stack-depth-1,
    // Sally M4: host modal then dialog). The 4.5 upgrade_stub toast is
    // gone (John V6 — the key dies with the re-pointing).
    //
    // Review P3 (5.7 full review) + M7: the effect must gate on the modal's
    // `open` prop — the provider's open() identity is now stable (M7: the
    // ref-mirror guard removed the isOpen dep), but a closed modal must
    // never hijack into the dialog (the error belongs to the modal's own
    // mutation lifecycle; a stale 'starter' must not re-open a dialog the
    // user closed).
    if (mutationError === 'starter' && open) {
      onOpenChange(false)
      openUpgradeDialog()
    }
  }, [mutationError, onOpenChange, openUpgradeDialog, open])

  // M12: the reset-on-open effect is GONE — ExportToolbar remounts this
  // modal on every open (key = open session), so the AC-pinned defaults
  // (include-unrevealed on, CSV) and a clean mutation state are inherent to
  // a fresh mount. No effect, no extra render pass, no stale-429 recovery
  // logic to maintain.

  const ids = useMemo(() => {
    if (preview === null) return []
    if (includeUnrevealed) return preview.ids
    return preview.rows.filter((row) => row.revealed).map((row) => row.id)
  }, [preview, includeUnrevealed])

  const cost = includeUnrevealed ? (preview?.totalRows ?? 0) : (preview?.revealedCount ?? 0)
  const insufficient = balance !== null && balance < cost
  const confirmLocked =
    insufficient ||
    balance === null ||
    preview === null ||
    preview.totalRows === 0 ||
    ids.length === 0 ||
    isPending
  const confirmMuted =
    insufficient || balance === null || preview === null || preview.totalRows === 0 || ids.length === 0
  const balanceAfter = balance === null ? null : balance - cost

  const regionError =
    mutationError === 'limit' ||
    mutationError === 'credits' ||
    mutationError === 'concurrent' ||
    mutationError === 'generic'
      ? mutationError
      : undefined

  const handleConfirm = () => {
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
      // 5.7 re-point (John V8): the xlsx tooltip click opens the single
      // Upgrade Dialog (the AC's "xlsx tooltip" entry point) — host modal
      // closes first. The upgrade_stub toast is gone.
      onOpenChange(false)
      openUpgradeDialog()
      return
    }
    setFormat(next)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] gap-3 overflow-y-auto overflow-x-hidden p-3 sm:max-w-[620px] sm:p-4">
        <DialogHeader>
          <DialogTitle className="text-title">
            {t(freeTier ? 'export.modal.title_free' : 'export.modal.title')}
          </DialogTitle>
        </DialogHeader>

        <ExportErrorRegion regionError={regionError} onRetry={handleRetry} />

        {regionError === undefined && (
          <div className="flex flex-col gap-2.5">
            <ExportCostSummary
              freeTier={freeTier}
              loading={isCollecting || preview === null}
              totalRows={preview?.totalRows ?? null}
              revealedCount={preview?.revealedCount ?? 0}
              includedUnrevealed={includeUnrevealed ? (preview?.unrevealedCount ?? 0) : 0}
              cost={cost}
              balanceAfter={balanceAfter}
            />

            <label className="flex min-h-10 items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={includeUnrevealed}
                onChange={(event) => setIncludeUnrevealed(event.target.checked)}
                className="size-4 rounded-sm border border-input"
              />
              <span>{t('export.modal.include_unrevealed')}</span>
            </label>

            <ExportPreviewBox
              tab={tab}
              freeTier={freeTier}
              includeUnrevealed={includeUnrevealed}
              preview={preview}
            />

            <div className="flex flex-col gap-2">
              <ExportFormatToggle format={format} freeTier={freeTier} onSelect={handleFormatClick} />
              {insufficient && balance !== null && (
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
              <ExportConfirmButton
                cost={cost}
                locked={confirmLocked}
                muted={confirmMuted}
                insufficient={insufficient && balance !== null}
                isPending={isPending}
                onConfirm={handleConfirm}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
