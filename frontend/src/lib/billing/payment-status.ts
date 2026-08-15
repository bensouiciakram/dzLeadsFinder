import { PAYMENT_POLL_DEADLINE_MS } from '@/lib/api/billing-service'

export type PaymentCardState = 'polling' | 'success' | 'timeout' | 'failed'

// The pure status derivation (M14 pure-logic extraction): terminal server
// statuses win over the local deadline; a NaN deadline (unreachable via
// the storage validation, but the card must not spin) counts as passed.
export function classifyPaymentStatus(
  status: string | undefined,
  startedAt: string | null,
  now: number,
): PaymentCardState {
  if (status === 'succeeded') return 'success'
  if (status === 'failed' || status === 'refunded') return 'failed'
  const deadlineMs =
    startedAt === null ? null : new Date(startedAt).getTime() + PAYMENT_POLL_DEADLINE_MS
  if (deadlineMs !== null && (Number.isNaN(deadlineMs) || now >= deadlineMs)) return 'timeout'
  return 'polling'
}