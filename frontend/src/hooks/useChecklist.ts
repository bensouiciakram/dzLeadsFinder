'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import {
  checklistService,
  completedSteps,
  type ChecklistState,
  type ChecklistStep,
} from '@/lib/api/checklist-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'
import type { SessionUser } from '@/lib/api/auth-service'
import { queryPhase, type QueryPhase } from '@/lib/queryPhase'

type ChecklistPhase = QueryPhase

type UseChecklistResult = {
  state: ChecklistState | null
  phase: ChecklistPhase
  isFetching: boolean
  refetch: () => void
  completed: ChecklistStep[]
}

export function useChecklist({ user }: { user: SessionUser | null }): UseChecklistResult {
  const query = useQuery({
    // The state key is user-scoped: the cache must never serve one account's
    // dismissal/completion to another (logout → login within staleTime).
    // Mutations invalidate via checklistKeys.all (prefix), which covers every
    // user's state key.
    queryKey: user === null ? checklistKeys.idle : checklistKeys.state(user.email),
    queryFn: async (): Promise<ChecklistState> => checklistService.get(),
    enabled: user !== null,
    // The checklist changes only via (a) the user's own dismiss mutation
    // (invalidates) and (b) Epic-4 completion mutations (contract: they
    // invalidate checklistKeys.all) — a 60s staleTime only serves same-session
    // remounts, and completions are always driven by invalidation-triggered
    // refetches, never stale data (AD-21 cache-tuning rationale).
    staleTime: 60_000,
  })

  const phase: ChecklistPhase = queryPhase(user !== null, query)

  const refetch = useCallback(() => {
    void query.refetch()
  }, [query])

  return {
    state: query.data ?? null,
    phase,
    isFetching: query.isFetching,
    refetch,
    completed: completedSteps(query.data ?? null),
  }
}
