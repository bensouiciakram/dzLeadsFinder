'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { useCredits } from '@/components/providers/CreditProvider'
import { useSession } from '@/components/providers/SessionProvider'
import { revealService } from '@/lib/api/reveal-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'
import { revealKeys } from '@/lib/queryKeys/reveal'
import { searchKeys } from '@/lib/queryKeys/search'

export type RevealVariables = {
  type: 'people' | 'company'
  id: string
}

export type RevealInFlight = (RevealVariables & { userKey: string }) | null

type SearchCacheRow = {
  id: string
  revealed: boolean
}

function isSearchCache(value: unknown): value is { results: SearchCacheRow[] } {
  if (typeof value !== 'object' || value === null) return false
  const data = value as { results?: unknown }
  return Array.isArray(data.results)
}

export function useReveal() {
  const queryClient = useQueryClient()
  const { user, refresh } = useSession()
  const { applyCreditDelta, applyConfirmedBalance } = useCredits()
  const userKey = user?.email ?? 'guest'
  const sessionKeyRef = useRef(userKey)

  useEffect(() => {
    sessionKeyRef.current = userKey
  }, [userKey])

  const reveal = useMutation({
    mutationFn: ({ type, id }: RevealVariables) => revealService.reveal(type, id),
    onMutate: (variables) => {
      queryClient.setQueryData(revealKeys.inFlight, {
        ...variables,
        userKey,
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
      queryClient.setQueryData(revealKeys.contact(userKey, type, id), result)
      queryClient.setQueriesData({ queryKey: searchKeys.all }, (old: unknown) => {
        if (!isSearchCache(old)) return old
        return {
          ...old,
          results: old.results.map((row) =>
            row.id === id ? { ...row, revealed: true } : row,
          ),
        }
      })
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
