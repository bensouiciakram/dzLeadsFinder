'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'

import { useCredits } from '@/components/providers/CreditProvider'
import {
  exportService,
  isConcurrentExportError,
  isExportLimitError,
  isRecordNotFoundError,
  isStarterOnlyError,
  type CreateExportResponse,
  type ExportFormat,
} from '@/lib/api/export-service'
import { isInsufficientCreditsError } from '@/lib/api/reveal-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'

type ExportPayload = {
  record_ids: string[]
  format: ExportFormat
  include_unrevealed: boolean
}

export type ExportError = 'limit' | 'credits' | 'starter' | 'concurrent' | 'generic'

function mapExportError(error: unknown): ExportError {
  if (isExportLimitError(error)) return 'limit'
  if (isInsufficientCreditsError(error)) return 'credits'
  if (isStarterOnlyError(error)) return 'starter'
  if (isConcurrentExportError(error)) return 'concurrent'
  if (isRecordNotFoundError(error)) return 'generic'
  return 'generic'
}

export function useExport({
  onSuccess,
}: {
  onSuccess?: (result: CreateExportResponse) => void
}) {
  const queryClient = useQueryClient()
  const { applyConfirmedBalance } = useCredits()
  const inFlightRef = useRef(false)
  const [error, setError] = useState<ExportError | undefined>(undefined)

  const mutation = useMutation({
    mutationFn: (payload: ExportPayload) => exportService.create(payload),
    // retry:false is a CREDIT contract (the 4.4 atomic-debit + 429/402
    // rollback guarantee): a retried POST after a lost response would
    // DOUBLE-BURN credits — the first request may have committed. The
    // global client only disables query retries; mutations default to 3.
    retry: false,
    onSuccess: (result) => {
      inFlightRef.current = false
      setError(undefined)
      if (result.balances !== undefined && result.balances !== null) {
        applyConfirmedBalance(result.balances)
      }
      void queryClient.invalidateQueries({ queryKey: checklistKeys.all })
      onSuccess?.(result)
    },
    onError: (err: unknown) => {
      inFlightRef.current = false
      setError(mapExportError(err))
    },
  })

  const create = useCallback(
    (payload: ExportPayload) => {
      if (inFlightRef.current) return
      // Offline fail-fast (deferred-work manual-testing fix): the POST would
      // hang until the 20s timeout (or indefinitely) — surface the generic
      // network state immediately instead of stranding the modal spinner.
      if (navigator.onLine === false) {
        setError('generic')
        return
      }
      inFlightRef.current = true
      setError(undefined)
      mutation.mutate(payload)
    },
    [mutation],
  )

  const reset = useCallback(() => {
    inFlightRef.current = false
    setError(undefined)
  }, [])

  return {
    create,
    isPending: mutation.isPending,
    error,
    reset,
  }
}
