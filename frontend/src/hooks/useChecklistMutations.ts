'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { checklistService, type ChecklistState } from '@/lib/api/checklist-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'

type UseChecklistMutationsResult = {
  dismiss: {
    mutate: () => void
    mutateAsync: () => Promise<ChecklistState>
    isPending: boolean
  }
}

export function useChecklistMutations(): UseChecklistMutationsResult {
  const queryClient = useQueryClient()

  const dismiss = useMutation({
    mutationFn: (): Promise<ChecklistState> => checklistService.dismiss(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: checklistKeys.all }),
  })

  return {
    dismiss: {
      mutate: dismiss.mutate,
      mutateAsync: dismiss.mutateAsync,
      isPending: dismiss.isPending,
    },
  }
}
