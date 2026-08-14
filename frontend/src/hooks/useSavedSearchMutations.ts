'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  savedSearchService,
  type SavedSearchPayload,
  type SavedSearchRow,
} from '@/lib/api/saved-search-service'
import { savedSearchesKeys } from '@/lib/queryKeys/savedSearches'

type UseSavedSearchMutationsResult = {
  create: {
    mutate: (payload: SavedSearchPayload) => void
    mutateAsync: (payload: SavedSearchPayload) => Promise<SavedSearchRow>
    isPending: boolean
  }
  rename: {
    mutate: (args: { id: string; name: string }) => void
    mutateAsync: (args: { id: string; name: string }) => Promise<SavedSearchRow>
    isPending: boolean
  }
  remove: {
    mutate: (id: string) => void
    mutateAsync: (id: string) => Promise<void>
    isPending: boolean
  }
}

export function useSavedSearchMutations(): UseSavedSearchMutationsResult {
  const queryClient = useQueryClient()

  const invalidateList = () =>
    void queryClient.invalidateQueries({ queryKey: savedSearchesKeys.all })

  const create = useMutation({
    mutationFn: (payload: SavedSearchPayload): Promise<SavedSearchRow> =>
      savedSearchService.create(payload),
    onSuccess: invalidateList,
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }): Promise<SavedSearchRow> =>
      savedSearchService.rename(id, name),
    onSuccess: invalidateList,
  })

  const remove = useMutation({
    mutationFn: (id: string): Promise<void> => savedSearchService.remove(id),
    onSuccess: invalidateList,
  })

  return {
    create: {
      mutate: create.mutate,
      mutateAsync: create.mutateAsync,
      isPending: create.isPending,
    },
    rename: {
      mutate: rename.mutate,
      mutateAsync: rename.mutateAsync,
      isPending: rename.isPending,
    },
    remove: {
      mutate: remove.mutate,
      mutateAsync: remove.mutateAsync,
      isPending: remove.isPending,
    },
  }
}
