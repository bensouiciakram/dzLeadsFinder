'use client'

import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { useSession } from '@/components/providers/SessionProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { useCredits } from '@/components/providers/CreditProvider'
import {
  numerals,
  SUPPORT_EMAIL,
} from '@/lib/api/billing-service'
import { billingKeys } from '@/lib/queryKeys/billing'
import { usePaymentStatus, type PendingCheckout } from '@/hooks/usePaymentStatus'
import { clearPendingCheckout } from '@/lib/billing/checkoutStorage'

// The 5.6 status card (AC + DESIGN.md L335 + Sally mandates): a plain
// inline block above the plan card — never a Dialog/Sheet/Popover (no
// overlay, no focus trap — the rest of /billing stays interactive). The
// card root carries role="status" (Sally: the persistent text is the
// announcement; no aria-busy — it would swallow the mount announcement);
// the failed state flips the live role to alert (assertive). The success
// side effects (toast + pill baseline reset + session refresh +
// invalidation) fire from an effect AFTER the card state commits — frame
// separation so the card's role=status change is announced before the
// toast (Sally mandate 3; DOM order alone is not sufficient).
export function StatusCard({
  checkout,
  fallback = null,
}: {
  checkout: PendingCheckout | null
  // The ?status= URL-param fallback (John V3): no entry (cleared storage,
  // another tab/device, deep link) but the settings-pinned return URL says
  // success/failure — a STATIC card, never polling (a polling card without
  // a checkout id would be theater).
  fallback?: 'success' | 'failure' | null
}) {
  const t = useTranslations('billing')
  const { user, refresh } = useSession()
  const { toast } = useToast()
  const { resetBaseline } = useCredits()
  const queryClient = useQueryClient()
  const { state, cardType, creditsGranted } = usePaymentStatus({ user, checkout })
  const handledRef = useRef(false)

  const userKey = user?.email ?? 'guest'

  useEffect(() => {
    if (checkout === null || handledRef.current) return
    if (state !== 'success' && state !== 'timeout' && state !== 'failed') return
    handledRef.current = true
    clearPendingCheckout()
  }, [state, checkout])

  // Review P4: the success side effects must NOT be gated on the credit
  // count — a succeeded row with a null credits_granted (legacy/manual
  // data) still needs the invalidation + refresh + baseline reset, else the
  // plan/pill stay stale forever. Only the toast needs the count.
  const successHandledRef = useRef(false)
  useEffect(() => {
    if (state !== 'success' || successHandledRef.current) return
    successHandledRef.current = true
    // Frame 2: the card's success content already committed in frame 1 —
    // the role=status announcement lands before this toast (Sally mandate 3).
    if (creditsGranted !== null) {
      const flavorKey =
        cardType === 'pack_purchase'
          ? 'billing.status.success_pack'
          : 'billing.status.success_subscription'
      toast(flavorKey, { n: numerals(creditsGranted) })
    }
    resetBaseline()
    // The plan/packs/history sections refetch with the grant landed; the
    // session probe refreshes the header pill + tier.
    void queryClient.invalidateQueries({ queryKey: billingKeys.plan(userKey) })
    void queryClient.invalidateQueries({ queryKey: billingKeys.packs(userKey) })
    void queryClient.invalidateQueries({ queryKey: billingKeys.history(userKey) })
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, creditsGranted, cardType])

  // The static fallback path: no polling, no stash, no toast — the card is
  // a one-shot announcement the return URL triggered.
  if (checkout === null) {
    if (fallback === 'success') {
      return (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg bg-success-container p-3.5 text-small text-success-on-container"
        >
          <Check className="size-4 shrink-0" aria-hidden="true" />
          <span>{t('status.succeeded')}</span>
        </div>
      )
    }
    if (fallback === 'failure') {
      return (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg bg-danger-container p-3.5 text-small text-danger-on-container"
        >
          {t.rich('history.failed_note', {
            support: () => (
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium underline"
              >
                {t('history.support_link')}
              </a>
            ),
          })}
        </div>
      )
    }
    return null
  }

  const containerClass =
    state === 'failed'
      ? 'bg-danger-container text-danger-on-container'
      : state === 'success'
        ? 'bg-success-container text-success-on-container'
        : 'bg-info-container text-info-on-container'

  let content: React.ReactNode
  if (state === 'success') {
    const flavorKey =
      cardType === 'pack_purchase'
        ? 'status.success_pack'
        : 'status.success_subscription'
    content = (
      <>
        <Check
          data-testid="status-success-check"
          className="size-4 shrink-0"
          aria-hidden="true"
        />
        <span>{t(flavorKey, { n: numerals(creditsGranted ?? 0) })}</span>
      </>
    )
  } else if (state === 'failed') {
    content = t.rich('history.failed_note', {
      support: () => (
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-medium underline"
        >
          {t('history.support_link')}
        </a>
      ),
    })
  } else if (state === 'timeout') {
    content = <span>{t('status.timeout')}</span>
  } else {
    content = (
      <>
        <Loader2
          data-testid="status-spinner"
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span>{t('status.polling')}</span>
      </>
    )
  }

  return (
    <div
      role={state === 'failed' ? 'alert' : 'status'}
      className={`flex items-center gap-2.5 rounded-lg p-3.5 text-small ${containerClass}`}
    >
      {content}
    </div>
  )
}
