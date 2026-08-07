'use client'

import { useQuery } from '@tanstack/react-query'

import { creditsService } from '@/lib/api/credits-service'
import { creditsKeys } from '@/lib/queryKeys/credits'
import type { SessionUser } from '@/lib/api/auth-service'

export type CreditsBannerPhase = 'idle' | 'loading' | 'error' | 'success'

export type UseCreditsBannerResult = {
  dismissed: boolean
  phase: CreditsBannerPhase
  refetch: () => void
}

export function useCreditsBanner({
  user,
}: {
  user: SessionUser | null
}): UseCreditsBannerResult {
  const userKey = user?.email ?? 'guest'
  const query = useQuery({
    queryKey: creditsKeys.banner(userKey),
    queryFn: () => creditsService.getBanner(),
    // Free users are the only audience for the welcome banner — Starter
    // users never see it, so their visits must not pay the request.
    enabled: user !== null && user.tier === 'free',
  })

  const phase: CreditsBannerPhase =
    user === null
      ? 'idle'
      : query.isError
        ? 'error'
        : query.isPending
          ? 'loading'
          : 'success'

  return {
    dismissed: query.data?.dismissed ?? false,
    phase,
    refetch: () => void query.refetch(),
  }
}
