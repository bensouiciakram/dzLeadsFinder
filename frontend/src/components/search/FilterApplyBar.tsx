'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

type FilterApplyBarProps = {
  busy: boolean
  rateLimited: boolean
  rateLimitMessage?: string
  idPrefix: string
  onApply: () => void
}

export function FilterApplyBar({
  busy,
  rateLimited,
  rateLimitMessage,
  idPrefix,
  onApply,
}: FilterApplyBarProps) {
  const t = useTranslations()
  const rateLimitId = `${idPrefix}-rate-limit`
  return (
    <div className="p-4">
      {rateLimited && (
        <p id={rateLimitId} className="mb-2 text-caption text-destructive">
          {rateLimitMessage ?? t('search.results.rate_limited')}
        </p>
      )}
      <Button
        className="min-h-11 w-full rounded-md md:min-h-8"
        aria-disabled={busy || rateLimited}
        aria-describedby={rateLimited ? rateLimitId : undefined}
        onClick={onApply}
      >
        {busy ? t('common.states.loading') : t('search.filters.apply')}
      </Button>
    </div>
  )
}
