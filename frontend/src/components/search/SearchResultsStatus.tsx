'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import type { SearchPhase } from '@/hooks/useSearchResults'

type SearchResultsStatusProps = {
  phase: SearchPhase
  rateLimitMessage: string | undefined
  total: number | undefined
  truncated: boolean | undefined
  announcement: string | null
  onRetry: () => void
}

export function SearchResultsStatus({
  phase,
  rateLimitMessage,
  total,
  truncated,
  announcement,
  onRetry,
}: SearchResultsStatusProps) {
  const t = useTranslations()
  return (
    <div aria-live="polite" data-testid="results-status">
      {phase === 'loading' && (
        <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>
      )}
      {phase === 'error' && (
        <div role="alert" className="rounded-lg border border-border bg-card p-6">
          <p className="text-small">{t('common.states.error')}</p>
          <Button variant="outline" className="mt-3" onClick={onRetry}>
            {t('search.results.retry')}
          </Button>
        </div>
      )}
      {phase === 'rate_limited' && (
        <p className="text-small text-destructive">
          {rateLimitMessage ?? t('search.results.rate_limited')}
        </p>
      )}
      {phase === 'idle' && total !== undefined && (
        <>
          <p className="text-small text-muted-foreground tabular-nums">
            {total > 0 ? t('search.results.count', { count: String(total) }) : t('search.results.empty')}
          </p>
          {truncated && (
            <p className="mt-1 text-caption text-muted-foreground">{t('search.results.truncated')}</p>
          )}
          {announcement !== null && (
            <span className="sr-only" role="status">
              {announcement}
            </span>
          )}
        </>
      )}
    </div>
  )
}
