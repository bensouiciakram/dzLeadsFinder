'use client'

import { useTranslations } from 'next-intl'
import { TriangleAlert } from 'lucide-react'

import { useSession } from '@/components/providers/SessionProvider'
import { usePlan } from '@/hooks/usePlan'
import { useCheckoutRedirect } from '@/hooks/useCheckoutRedirect'
import { SUBSCRIPTION_PRICE_DZD } from '@/lib/api/billing-service'

// The persistent failed-renewal banner (FR-28; Sally M3 anatomy):
// non-dismissible (no X — "the banner persists until payment succeeds"),
// danger-container/danger-on-container, compact 40px, on ALL authenticated
// surfaces (AppShell mounts it below the Header), in-flow (pushes content —
// never an overlay; the sticky header stays z-50).
//
// The AC's "Link → Chargily update-payment page" (Winston Q2 / John V3):
// Chargily V1 has no customer-portal/update-payment surface and no such URL
// exists in settings — the link performs the RETRY-PAYMENT redirect via
// create-checkout (type=subscription — the 5.5 failed_renewal retry CTA
// precedent; the re-activated row is now-anchored per 5.5 D19). The AC
// sentence's second clause IS the underlined anchor (rich text — no
// separate link key). A settings-pinned CHARGILY_PAYMENT_URL is the
// pre-prod docs gate: if Chargily ships a real payment-method page, the
// anchor's href swaps in one file.
//
// role="alert" (assertive): sanctioned for payment failure ("toasts never
// announce assertively unless a payment failed" — EXPERIENCE.md L180); the
// banner mounts once per session in the root layout and announces on the
// state flip, not on navigation.
export function FailedRenewalBanner() {
  const t = useTranslations('billing')
  const states = useTranslations('common.states')
  const { user } = useSession()
  const { plan, phase } = usePlan({ user })
  const { redirecting, error, redirect } = useCheckoutRedirect()

  if (
    user === null ||
    phase !== 'success' ||
    plan === null ||
    plan.status !== 'failed_renewal'
  ) {
    return null
  }

  return (
    <div
      role="alert"
      data-testid="failed-renewal-banner"
      className="flex min-h-10 w-full items-center gap-2.5 bg-danger-container px-4 text-danger-on-container"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      <p className="text-small">
        {t.rich('failed_renewal', {
          // Review P1 fix: next-intl v4 TAG syntax — the AC's second clause
          // lives INSIDE the <update>…</update> tags in the message; the
          // renderer receives the clause as chunks (the 5.7-era
          // {update}-value-with-function pattern rendered an EMPTY anchor —
          // the clause never appeared).
          update: (chunks) => (
            <a
              href="#"
              aria-busy={redirecting}
              onClick={(event) => {
                event.preventDefault()
                void redirect('subscription', SUBSCRIPTION_PRICE_DZD)
              }}
              className="font-medium underline underline-offset-2 hover:opacity-90"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
      {error ? (
        // Review P10: no nested role=alert — the banner root is already
        // the assertive live region; the inner span is plain text.
        <span className="text-small">{states('error')}</span>
      ) : null}
    </div>
  )
}
