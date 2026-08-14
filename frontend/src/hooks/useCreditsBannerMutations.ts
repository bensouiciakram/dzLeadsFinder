'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { creditsService, type CreditsBannerState } from '@/lib/api/credits-service'
import { creditsKeys } from '@/lib/queryKeys/credits'

type UseCreditsBannerMutationsResult = {
  dismiss: {
    mutate: () => void
    mutateAsync: () => Promise<CreditsBannerState>
    isPending: boolean
  }
}

export function useCreditsBannerMutations(): UseCreditsBannerMutationsResult {
  const queryClient = useQueryClient()

  const dismiss = useMutation({
    mutationFn: (): Promise<CreditsBannerState> => creditsService.dismissBanner(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: creditsKeys.all }),
  })

  return {
    dismiss: {
      mutate: dismiss.mutate,
      mutateAsync: dismiss.mutateAsync,
      isPending: dismiss.isPending,
    },
  }
}
