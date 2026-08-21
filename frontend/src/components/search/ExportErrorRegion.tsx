'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

// The narrowed subset of the export mutation errors that swap the whole
// form for a full-region state ('starter' never reaches this surface —
// it re-points to the Upgrade Dialog instead).
export type ExportRegionError = 'limit' | 'credits' | 'concurrent' | 'generic'

type ExportErrorRegionProps = {
  regionError: ExportRegionError | undefined
  onRetry: () => void
}

const REGION_CLASS_NAME =
  'rounded-md border border-border bg-muted/50 p-4 text-small text-muted-strong focus:outline-none'

export function ExportErrorRegion({ regionError, onRetry }: ExportErrorRegionProps) {
  const t = useTranslations()
  const regionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (regionError !== undefined) {
      regionRef.current?.focus()
    }
  }, [regionError])

  if (regionError === undefined) return null

  if (regionError === 'limit') {
    return (
      <div ref={regionRef} tabIndex={-1} role="status" className={REGION_CLASS_NAME}>
        {t('export.modal.come_back_tomorrow')}
      </div>
    )
  }
  if (regionError === 'credits') {
    return (
      <div ref={regionRef} tabIndex={-1} role="alert" className={REGION_CLASS_NAME}>
        {t('export.modal.error_credits')}
      </div>
    )
  }
  return (
    <div ref={regionRef} tabIndex={-1} role="alert" className={REGION_CLASS_NAME}>
      <p>{t(regionError === 'concurrent' ? 'export.modal.error_concurrent' : 'export.modal.error_generic')}</p>
      <button
        type="button"
        className="mt-3 min-h-11 rounded-md border border-border bg-card px-4 text-small text-muted-strong md:min-h-10"
        onClick={onRetry}
      >
        {t('search.results.retry')}
      </button>
    </div>
  )
}
