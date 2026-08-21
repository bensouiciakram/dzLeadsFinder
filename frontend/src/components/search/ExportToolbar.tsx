'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ExportModal } from '@/components/search/ExportModal'
import { useCredits } from '@/components/providers/CreditProvider'
import { Button } from '@/components/ui/button'
import type { SearchSubmitted } from '@/hooks/useSearchResults'
import type { SearchTab } from '@/lib/api/search-service'
import type { EntitlementTier } from '@/lib/entitlement'

type ExportToolbarProps = {
  tab: SearchTab
  submitted: SearchSubmitted | null
  nonce: number
  total: number
  isFetching: boolean
  tier: EntitlementTier
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
  // M12: the remount key — every open increments the session, so the modal
  // mounts FRESH each time (AC-pinned defaults + clean mutation state)
  // WITHOUT cutting the close animation (the key stays put while closing,
  // unlike a `key={open}` flip).
  const [openSession, setOpenSession] = useState(0)

  if (submitted === null || total <= 0) return null

  return (
    <div className="flex items-center justify-end">
      <Button
        variant="outline"
        aria-disabled={isFetching || undefined}
        onClick={() => {
          if (!isFetching) {
            setOpen(true)
            setOpenSession((current) => current + 1)
          }
        }}
        className="min-h-11 md:min-h-10"
      >
        {t('common.actions.export')}
      </Button>
      <ExportModal
        key={openSession}
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
