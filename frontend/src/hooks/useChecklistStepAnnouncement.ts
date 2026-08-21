'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

import type { ChecklistState } from '@/lib/api/checklist-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'

type UseChecklistStepAnnouncementArgs = {
  state: ChecklistState | null
  searchSuccess: boolean
  announce: (message: string) => void
}

// Step-1 completion announcement. Two complementary mechanisms:
// (a) the card's step-flip effect fires onStepComplete when the refetched
// state flips mid-session (the normal path — the pre-flip state was seeded
// on the mount fetch);
// (b) if the mount checklist fetch FAILED, the card has no pre-flip state
// to diff against — its first success seeds silently and no flip is
// detected. In that case the checklist had no data at search-success time,
// so THIS hook takes over and announces once the refetch lands with
// step_search true. Both paths can never double-announce: (b) is armed
// only when the checklist data was never seen.
export function useChecklistStepAnnouncement({
  state,
  searchSuccess,
  announce,
}: UseChecklistStepAnnouncementArgs) {
  const t = useTranslations()
  const queryClient = useQueryClient()

  const checklistDataSeenRef = useRef(false)
  if (state !== null) checklistDataSeenRef.current = true
  const step1PendingRef = useRef(false)

  useEffect(() => {
    if (searchSuccess) {
      if (!checklistDataSeenRef.current) step1PendingRef.current = true
      void queryClient.invalidateQueries({ queryKey: checklistKeys.all })
    }
  }, [searchSuccess, queryClient])

  useEffect(() => {
    if (!step1PendingRef.current) return
    if (state?.step_search !== true) return
    step1PendingRef.current = false
    announce(t('search.checklist.done_search'))
  }, [state, t, announce])
}
