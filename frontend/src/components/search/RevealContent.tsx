'use client'

import { useTranslations } from 'next-intl'

import { RevealContactFields } from '@/components/search/RevealFields'
import type { RevealState } from '@/hooks/useRevealState'

export function RevealContent({ state }: { state: RevealState }) {
  const t = useTranslations()
  if (!state.showRegion) return null
  return (
    <div
      id={state.regionId}
      role="region"
      aria-label={t('search.reveal.content')}
      data-testid={`reveal-content-${state.rowId}`}
      className="mt-3 border-t border-border pt-3"
    >
      {state.contactData !== undefined ? (
        <RevealContactFields contact={state.contactData.contact} />
      ) : (
        <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>
      )}
    </div>
  )
}
