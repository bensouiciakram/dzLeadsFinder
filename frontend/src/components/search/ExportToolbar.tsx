'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ExportModal } from '@/components/search/ExportModal'
import { useCredits } from '@/components/providers/CreditProvider'
import { Button } from '@/components/ui/button'
import type { SearchSubmitted } from '@/hooks/useSearchResults'
import type { SearchTab } from '@/lib/api/search-service'

export type ExportToolbarProps = {
  tab: SearchTab
  submitted: SearchSubmitted | null
  nonce: number
  total: number
  isFetching: boolean
  tier: 'free' | 'starter'
}

export function ExportToolbar({
  tab,
  submitted,
  nonce,
  total,
  isFetching,
  tier,
}: ExportToolbarProps) {
  const t = useTranslations()
  const { balance } = useCredits()
  const [open, setOpen] = useState(false)

  if (submitted === null || total <= 0) return null

  return (
    <div className="flex items-center justify-end">
      <Button
        variant="outline"
        aria-disabled={isFetching || undefined}
        onClick={() => {
          if (!isFetching) setOpen(true)
        }}
        className="min-h-11 md:min-h-10"
      >
        {t('common.actions.export')}
      </Button>
      <ExportModal
        open={open}
        onOpenChange={setOpen}
        tab={tab}
        filtersJson={submitted.filtersJson}
        sort={submitted.sort}
        nonce={nonce}
        total={total}
        tier={tier}
        balance={balance}
      />
    </div>
  )
}
