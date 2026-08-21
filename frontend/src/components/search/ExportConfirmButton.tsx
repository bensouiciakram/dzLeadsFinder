'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

type ExportConfirmButtonProps = {
  cost: number
  // Honest-disabled: aria-disabled (still clickable — the parent decides
  // between the no-credits toast and the noop). Covers isPending too.
  locked: boolean
  // The tonal treatment tracks only the SUBSTANTIVE locks — a pending
  // export with a valid selection keeps the primary fill under its spinner.
  muted: boolean
  insufficient: boolean
  isPending: boolean
  onConfirm: () => void
}

export function ExportConfirmButton({
  cost,
  locked,
  muted,
  insufficient,
  isPending,
  onConfirm,
}: ExportConfirmButtonProps) {
  const t = useTranslations()
  return (
    <button
      type="button"
      aria-busy={isPending || undefined}
      aria-disabled={locked || undefined}
      aria-describedby={insufficient ? 'export-insufficient-note' : undefined}
      onClick={onConfirm}
      className={`min-h-10 w-full min-w-[10rem] rounded-md px-4 text-small font-semibold ${
        muted ? 'border border-border bg-muted text-muted-strong' : 'bg-primary text-primary-foreground'
      }`}
    >
      {isPending ? (
        <>
          <Loader2 className="me-2 inline size-4 animate-spin" aria-hidden="true" />
          <span className="sr-only">{t('common.credits.exporting')}</span>
          <span aria-hidden="true">{t('export.modal.confirm', { count: String(cost) })}</span>
        </>
      ) : (
        t('export.modal.confirm', { count: String(cost) })
      )}
    </button>
  )
}
