'use client'

import { useCallback, useState } from 'react'

import { billingService, type CheckoutType } from '@/lib/api/billing-service'
import { navigator } from '@/lib/api/http-client'

export type UseCheckoutRedirectResult = {
  redirecting: boolean
  error: boolean
  redirect: (type: CheckoutType, amount: number) => Promise<void>
}

// Shared by every billing CTA (PlanCard Upgrade/Reactivate/Retry/Resubscribe
// + PackCards Buy): POST create-checkout, then leave for the Chargily page.
// The 5.6 return flow (status card + polling + toast) owns what happens on
// the way back — 5.5 just redirects. A failure surfaces as an inline
// role=alert line in the calling section (no toast — 5.6's slot).
export function useCheckoutRedirect(): UseCheckoutRedirectResult {
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState(false)

  const redirect = useCallback(
    async (type: CheckoutType, amount: number): Promise<void> => {
      if (redirecting) return
      setRedirecting(true)
      setError(false)
      try {
        const { checkout_url } = await billingService.createCheckout(type, amount)
        navigator.assign(checkout_url)
      } catch {
        setError(true)
      } finally {
        setRedirecting(false)
      }
    },
    [redirecting],
  )

  return { redirecting, error, redirect }
}
