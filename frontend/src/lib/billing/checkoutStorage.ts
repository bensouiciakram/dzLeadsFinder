// 'use client' removed (M14-era cleanup): a pure storage module with its
// own window guards — the directive only forced client bundling. Safe from
// server components too: every accessor short-circuits without window.

// M9: the stash shape lives with the storage module — the storage layer
// must not depend on the hook layer (usePaymentStatus imports it from
// here, not the other way around).
export type PendingCheckout = {
  checkout_id: string
  // The server-issued checkout start (create-checkout started_at) — the
  // exact since-bound AND the 60s deadline anchor (AC ≤60s; the FE owns the
  // window per the spine L631 polling bridge).
  started_at: string
}

// The 5.6 pending-checkout bridge (John V3): the entry the StatusCard
// consumes on the /billing return — stashed by useCheckoutRedirect before
// the Chargily redirect, read by the card on mount, cleared on terminal
// states. sessionStorage is per-tab (the ?status= fallback covers cleared
// storage / another tab / deep links).
export const PENDING_CHECKOUT_KEY = 'billing.pending_checkout'

export function readPendingCheckout(): PendingCheckout | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { checkout_id?: unknown }).checkout_id === 'string' &&
      (parsed as { checkout_id?: unknown }).checkout_id !== '' &&
      typeof (parsed as { started_at?: unknown }).started_at === 'string'
    ) {
      // Review P2: an unparseable started_at would produce a NaN deadline
      // in the polling hook — infinite polling of a 400-returning endpoint
      // with the stash never cleared. Reject non-ISO values here.
      const startedMs = new Date((parsed as { started_at: string }).started_at).getTime()
      if (!Number.isNaN(startedMs)) {
        return parsed as PendingCheckout
      }
    }
  } catch {
    // Corrupt stash — treat as absent (the ?status= fallback still applies).
  }
  window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
  return null
}

export function stashPendingCheckout(checkout: PendingCheckout): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(checkout))
}

export function clearPendingCheckout(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
}
