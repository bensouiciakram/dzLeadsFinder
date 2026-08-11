'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { PlanCard } from '@/components/billing/PlanCard'
import { PackCards } from '@/components/billing/PackCards'
import { PaymentHistoryTable } from '@/components/billing/PaymentHistoryTable'
import { DangerZone } from '@/components/billing/DangerZone'
import { StatusCard } from '@/components/billing/StatusCard'
import { useSession } from '@/components/providers/SessionProvider'
import { useBilling } from '@/hooks/useBilling'
import { readPendingCheckout, type PendingCheckout } from '@/lib/billing/checkoutStorage'

// The settings-pinned Chargily return URLs carry ?status=success|failure.
function readFallbackStatus(): 'success' | 'failure' | null {
  if (typeof window === 'undefined') return null
  const status = new URLSearchParams(window.location.search).get('status')
  if (status === 'success') return 'success'
  if (status === 'failure') return 'failure'
  return null
}

function stripStatusParam(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (url.searchParams.has('status')) {
    url.searchParams.delete('status')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }
}

export function BillingPage() {
  const t = useTranslations('billing')
  const { user } = useSession()
  const { plan, packs, history, planPhase, packsPhase, historyPhase, cancel } =
    useBilling({ user })

  // The 5.6 status-card trigger (John V3): the pending-checkout entry
  // stashed by useCheckoutRedirect is the primary path; the settings-pinned
  // ?status= URL param is the no-entry fallback (cleared storage, another
  // tab/device, deep link). The param is stripped after the first render —
  // on BOTH paths (review P3: an entry-wins session must not leave the
  // param behind, where a later refresh would re-trigger the static card).
  const [checkout, setCheckout] = useState<PendingCheckout | null>(() =>
    readPendingCheckout(),
  )
  const [fallback, setFallback] = useState<'success' | 'failure' | null>(() =>
    checkout === null ? readFallbackStatus() : null,
  )

  useEffect(() => {
    stripStatusParam()
  }, [])

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <h1 className="text-display font-bold">{t('title')}</h1>
      <div className="mt-8 space-y-8">
        <StatusCard checkout={checkout} fallback={fallback} />
        <PlanCard plan={plan} phase={planPhase} />
        <PackCards packs={packs} phase={packsPhase} />
        <PaymentHistoryTable history={history} phase={historyPhase} />
        <DangerZone plan={plan} phase={planPhase} cancel={cancel} />
      </div>
    </main>
  )
}
