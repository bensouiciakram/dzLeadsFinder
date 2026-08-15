'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  billingService,
  PAYMENT_POLL_DEADLINE_MS,
  PAYMENT_POLL_INTERVAL_MS,
  TERMINAL_PAYMENT_STATUSES,
  type StatusResult,
} from '@/lib/api/billing-service'
import { userKey } from '@/lib/user-key'
import { billingKeys } from '@/lib/queryKeys/billing'
import type { SessionUser } from '@/lib/api/auth-service'
import type { PendingCheckout } from '@/lib/billing/checkoutStorage'

type PaymentCardState = 'polling' | 'success' | 'timeout' | 'failed'

type UsePaymentStatusResult = {
  state: PaymentCardState
  cardType: string | null
  creditsGranted: number | null
}

// The 5.6 polling bridge (AD-20: "billing status-card ≤60s uses
// refetchInterval"): polls every 5s for 60s from the checkout start, stops
// on the first terminal status (succeeded/failed/refunded — John V5: also
// shrinks the concurrent-checkout window overlap), and degrades to the
// timeout state once the deadline passes while still pending. A refunded
// row maps into the failed family (John V1 — ops-manual, terminal).
export function usePaymentStatus({
  user,
  checkout,
}: {
  user: SessionUser | null
  checkout: PendingCheckout | null
}): UsePaymentStatusResult {
  const key = userKey(user)
  const txnId = checkout?.checkout_id ?? null
  const since = checkout?.started_at ?? null
  const deadlineMs = checkout
    ? new Date(checkout.started_at).getTime() + PAYMENT_POLL_DEADLINE_MS
    : null

  // The deadline alarm: the timeout flip must render even when no poll is
  // due at the exact deadline (the interval's next tick could be seconds
  // away — the state derivation is render-time only). Review P2
  // defense-in-depth: a NaN deadline (storage normally rejects unparseable
  // started_at, but belt-and-braces) must not spin the poll forever.
  const [, forceRender] = useState(0)
  useEffect(() => {
    if (deadlineMs === null || Number.isNaN(deadlineMs)) return
    const remaining = deadlineMs - Date.now()
    if (remaining <= 0) return
    const timer = window.setTimeout(() => forceRender((tick) => tick + 1), remaining)
    return () => window.clearTimeout(timer)
  }, [deadlineMs, txnId])

  const query = useQuery<StatusResult>({
    queryKey: billingKeys.status(key, txnId ?? 'none'),
    queryFn: () => billingService.status(txnId as string, since as string),
    enabled: user !== null && txnId !== null && since !== null,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (intervalQuery) => {
      const status = intervalQuery.state.data?.status
      if (status !== undefined && TERMINAL_PAYMENT_STATUSES.has(status)) return false
      if (deadlineMs !== null && Date.now() >= deadlineMs) return false
      return PAYMENT_POLL_INTERVAL_MS
    },
  })

  const status = query.data?.status ?? 'pending'
  // Review P2: a NaN deadline (unreachable via the storage validation, but
  // the hook must not spin) is treated as deadline-passed — the card
  // degrades to the timeout note instead of polling forever.
  const deadlinePassed =
    deadlineMs !== null && (Number.isNaN(deadlineMs) || Date.now() >= deadlineMs)

  let state: PaymentCardState
  if (status === 'succeeded') {
    state = 'success'
  } else if (status === 'failed' || status === 'refunded') {
    state = 'failed'
  } else if (deadlinePassed) {
    state = 'timeout'
  } else {
    state = 'polling'
  }

  return {
    state,
    cardType: query.data?.type ?? null,
    creditsGranted: query.data?.credits_granted ?? null,
  }
}
