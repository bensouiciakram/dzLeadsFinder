import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useCredits } from '@/components/providers/CreditProvider'
import { useSession } from '@/components/providers/SessionProvider'
import type { RevealInFlight } from '@/lib/reveal/reveal-cache'
import { userKey } from '@/lib/user-key'
import type { RevealResult } from '@/lib/api/reveal-service'
import { revealService } from '@/lib/api/reveal-service'
import { revealKeys } from '@/lib/queryKeys/reveal'
import type { CompanyResultRow, PeopleResultRow, SearchTab } from '@/lib/api/search-service'

export type RevealState = {
  recordType: 'people' | 'company'
  key: string
  rowId: string
  regionId: string
  contactData: RevealResult | undefined
  revealed: boolean
  pending: boolean
  autoFetching: boolean
  zeroCredits: boolean
  showRegion: boolean
}

export function useRevealState({
  tab,
  row,
}: {
  tab: SearchTab
  row: PeopleResultRow | CompanyResultRow
}): RevealState {
  const { user } = useSession()
  const { balance } = useCredits()
  const queryClient = useQueryClient()

  const recordType: 'people' | 'company' = tab === 'people' ? 'people' : 'company'
  const key = userKey(user)
  const rowId = row.id
  const regionId = `reveal-content-${rowId}`

  const cached = queryClient.getQueryData<RevealResult>(
    revealKeys.contact(key, recordType, rowId),
  )
  const contactQuery = useQuery({
    queryKey: revealKeys.contact(key, recordType, rowId),
    queryFn: () => revealService.reveal(recordType, rowId),
    enabled: row.revealed && cached === undefined,
  })
  const inFlightQuery = useQuery<RevealInFlight>({
    queryKey: revealKeys.inFlight,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  })
  const inFlight = inFlightQuery.data

  const pending = inFlight !== null && inFlight.type === recordType && inFlight.id === rowId
  const contactData = contactQuery.data
  const revealed = row.revealed || contactData !== undefined
  const autoFetching = row.revealed && contactQuery.isFetching
  const zeroCredits = balance !== null && balance <= 0
  const showRegion = pending || contactData !== undefined || autoFetching

  return {
    recordType,
    key,
    rowId,
    regionId,
    contactData,
    revealed,
    pending,
    autoFetching,
    zeroCredits,
    showRegion,
  }
}
