'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  billingService,
  PAYMENT_POLL_DEADLINE_MS,
  PAYMENT_POLL_INTERVAL_MS,
  TERMINAL_PAYMENT_STATUSES,
  type StatusResult,
} from '@/lib/api/billing-service'
import {
  armDeadlineAlarm,
  clearDeadlineAlarm,
  getDeadlineTick,
  subscribeDeadlineAlarm,
} from '@/lib/billing/deadline-alarm'
import { classifyPaymentStatus, type PaymentCardState } from '@/lib/billing/payment-status'
import { userKey } from '@/lib/user-key'
import { billingKeys } from '@/lib/queryKeys/billing'
import type { SessionUser } from '@/lib/api/auth-service'
import type { PendingCheckout } from '@/lib/billing/checkoutStorage'

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
//
// M14: the deadline flip is an external-time subscription (deadline-alarm
// store + useSyncExternalStore), NOT a counter-state render hack — the
// timeout renders exactly at the deadline even when no poll is due.
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

  // Subscribe to the deadline alarm: the snapshot flips once at the
  // deadline, re-rendering this hook so the timeout state derives.
  const deadlineTick = useSyncExternalStore(subscribeDeadlineAlarm, getDeadlineTick)

  // Arm the alarm for THIS deadline; re-arming on deadlineTick change is a
  // no-op (a passed deadline never bumps the tick again — no loops).
  useEffect(() => {
    if (deadlineMs === null || Number.isNaN(deadlineMs)) return
    armDeadlineAlarm(deadlineMs)
    return () => clearDeadlineAlarm()
  }, [deadlineMs, txnId, deadlineTick])

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

  const state = classifyPaymentStatus(query.data?.status, since, Date.now())

  return {
    state,
    cardType: query.data?.type ?? null,
    creditsGranted: query.data?.credits_granted ?? null,
  }
}