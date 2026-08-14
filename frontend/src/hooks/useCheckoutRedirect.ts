'use client'

import { useCallback, useState } from 'react'

import { billingService, type CheckoutType } from '@/lib/api/billing-service'
import { navigator } from '@/lib/api/http-client'
import { clearPendingCheckout, stashPendingCheckout } from '@/lib/billing/checkoutStorage'

type UseCheckoutRedirectResult = {
  redirecting: boolean
  error: boolean
  redirect: (type: CheckoutType, amount: number) => Promise<void>
}

// Shared by every billing CTA (PlanCard Upgrade/Reactivate/Retry/Resubscribe
// + PackCards Buy): POST create-checkout, then leave for the Chargily page.
// The 5.6 return flow (status card + polling + toast) owns what happens on
// the way back — 5.5 just redirects. A failure surfaces as an inline
// role=alert line in the calling section (no toast — 5.6's slot).
//
// 5.6 (John V3): the checkout_id + server started_at are STASHED in
// sessionStorage BEFORE the redirect — the StatusCard on /billing reads
// them after the Chargily round-trip (the entry path; the ?status= URL
// param is the no-entry fallback). Stash only on a successful create —
// a failed checkout leaves no phantom card behind.
//
// Review P9 (5.7 full review): a MODULE-LEVEL in-flight guard — the
// per-instance `redirecting` state only blocks double-clicks on ONE
// consumer, but 5.7 triples the simultaneous redirect-capable CTAs on a
// screen (chip + banner link + dialog CTAs + PlanCard): two concurrent
// create-checkout POSTs would double-stash (last-writer-wins) and orphan
// the first checkout. The module guard serializes ALL consumers — a
// second redirect attempt while any is in flight is a no-op.
let globalRedirectInFlight = false

export function useCheckoutRedirect(): UseCheckoutRedirectResult {
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState(false)

  const redirect = useCallback(
    async (type: CheckoutType, amount: number): Promise<void> => {
      if (redirecting || globalRedirectInFlight) return
      globalRedirectInFlight = true
      setRedirecting(true)
      setError(false)
      try {
        const { checkout_url, checkout_id, started_at } =
          await billingService.createCheckout(type, amount)
        stashPendingCheckout({ checkout_id, started_at })
        try {
          navigator.assign(checkout_url)
        } catch {
          // Review P7: if the navigation itself throws (blocked popup,
          // sandboxed iframe), the stash must not orphan — a later /billing
          // visit would poll a checkout that never began and promise credits.
          clearPendingCheckout()
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setRedirecting(false)
        globalRedirectInFlight = false
      }
    },
    [redirecting],
  )

  return { redirecting, error, redirect }
}
