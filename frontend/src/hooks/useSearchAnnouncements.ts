'use client'

import { useCallback, useEffect, useState } from 'react'

type UseSearchAnnouncementsArgs = {
  isError: boolean
}

// The search screen's single aria-live announcement channel: sort/page
// feedback, checklist step flips, and error clears all flow through one
// state so announcements never fight each other.
export function useSearchAnnouncements({ isError }: UseSearchAnnouncementsArgs) {
  const [announcement, setAnnouncement] = useState<string | null>(null)

  // A failed query invalidates any pending announcement — the retry button
  // is the next feedback surface.
  useEffect(() => {
    if (isError) setAnnouncement(null)
  }, [isError])

  const announce = useCallback((message: string) => {
    setAnnouncement(message)
  }, [])

  // Step announcements never clobber a fresher announcement from the user's
  // own action (sort/page land inside the flip window on the first search):
  // the user-action feedback wins, the step flip stays visible on the card.
  const announceOnce = useCallback((message: string) => {
    setAnnouncement((current) => (current === null ? message : current))
  }, [])

  const clear = useCallback(() => {
    setAnnouncement(null)
  }, [])

  return { announcement, announce, announceOnce, clear }
}
