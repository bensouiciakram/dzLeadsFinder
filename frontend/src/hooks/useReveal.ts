'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useCredits } from '@/components/providers/CreditProvider'
import { useSession } from '@/components/providers/SessionProvider'
import { revealService } from '@/lib/api/reveal-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'
import { revealKeys } from '@/lib/queryKeys/reveal'
import { searchKeys } from '@/lib/queryKeys/search'
import {
  updateSearchResultsWithReveal,
  type RevealInFlight,
  type RevealVariables,
} from '@/lib/reveal/reveal-cache'
import { userKey } from '@/lib/user-key'

export function useReveal() {
  const queryClient = useQueryClient()
  const { user, refresh } = useSession()
  const { applyCreditDelta, applyConfirmedBalance } = useCredits()
  const sessionKey = userKey(user)
  const sessionKeyRef = useRef(sessionKey)

  useEffect(() => {
    sessionKeyRef.current = sessionKey
  }, [sessionKey])

  const reveal = useMutation({
    mutationFn: ({ type, id }: RevealVariables) => revealService.reveal(type, id),
    onMutate: (variables) => {
      queryClient.setQueryData(revealKeys.inFlight, {
        ...variables,
        userKey: sessionKey,
      } satisfies RevealInFlight)
      applyCreditDelta(-1)
    },
    onSuccess: (result, { type, id }) => {
      // The userKey captured at dispatch (in the in-flight payload) vs the
      // session at settle time — a logout/login mid-flight must never write
      // the new user's UI.
      const inFlight = queryClient.getQueryData<RevealInFlight>(revealKeys.inFlight)
      if (inFlight === null || inFlight === undefined || inFlight.userKey !== sessionKeyRef.current) {
        return
      }
      if (result.balances !== undefined && result.balances !== null) {
        applyConfirmedBalance(result.balances)
      }
      queryClient.setQueryData(revealKeys.contact(sessionKey, type, id), result)
      queryClient.setQueriesData({ queryKey: searchKeys.all }, (old: unknown) =>
        updateSearchResultsWithReveal(old, id),
      )
      void queryClient.invalidateQueries({ queryKey: checklistKeys.all })
    },
    onError: () => {
      const inFlight = queryClient.getQueryData<RevealInFlight>(revealKeys.inFlight)
      if (inFlight === null || inFlight === undefined || inFlight.userKey !== sessionKeyRef.current) {
        return
      }
      applyCreditDelta(1)
      // The server may have committed the debit before the response was
      // lost (timeout/5xx) — the session /me probe carries the authoritative
      // credits_balance, so reconcile instead of trusting the blind +1.
      void refresh()
    },
    onSettled: () => {
      queryClient.setQueryData<RevealInFlight>(revealKeys.inFlight, null)
    },
  })

  return {
    reveal: {
      mutate: reveal.mutate,
      mutateAsync: reveal.mutateAsync,
      isPending: reveal.isPending,
      variables: reveal.variables,
    },
  }
}