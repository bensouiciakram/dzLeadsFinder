'use client'

import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useSession } from '@/components/providers/SessionProvider'
import { useUpgradeDialog } from '@/components/providers/UpgradeDialogProvider'
import { usePlan } from '@/hooks/usePlan'
import { useCheckoutRedirect } from '@/hooks/useCheckoutRedirect'
import {
  formatBillingDate,
  SUBSCRIPTION_PRICE_DZD,
} from '@/lib/api/billing-service'
import { cn } from '@/lib/utils'

function dateChunk(iso: string, locale: string) {
  // Review P1 fix: next-intl v4 rich text — the date renders via a
  // <date>…</date> TAG whose chunks are the interpolated {d} value. The
  // 5.5-era {date}-value-with-function pattern rendered null in the real
  // formatter (the tests' regex mocks masked it). The returned object is
  // the t.rich params spread: { date: tagRenderer, d: formatted }.
  const formatted = formatBillingDate(iso, locale, { withTime: false })
  return {
    date: (chunks: React.ReactNode) => (
      <bdi className="tabular-nums">{chunks}</bdi>
    ),
    d: formatted,
  }
}

// The header subscription-status readout (5.7 — the AC chip states ×5;
// Sally M2 anatomy). State is driven by plan.status, NEVER user.tier (the
// 5.5 D8 discipline — a cancelled user stays tier='starter' until the
// 5.7 expiry sync downgrades them; the chip must show "Cancelled — access
// until {date}", not a starter lie).
//
// Click matrix (John V2 / Winston Q6 / Sally M2 — the CONFLICT RESOLVED by
// majority): free + expired → the Upgrade Dialog (the expired variant is
// truthful after the tier sync and keeps the conversion surface); cancelled
// → the Upgrade Dialog (its Subscribe CTA IS the reactivation path — the
// create-checkout 409 blocks only ACTIVE); failed_renewal → the
// retry-payment redirect (the 5.5 PlanCard retry precedent — the banner
// owns the danger-toned alarm); starter (active) → NON-INTERACTIVE span
// (DESIGN.md L328: pill geometry signals meter or status, never a
// clickable primary action — the header already carries the Billing link).
export function SubscriptionChip() {
  const t = useTranslations('billing')
  const locale = useLocale()
  const { user } = useSession()
  const { plan, phase } = usePlan({ user })
  const { open } = useUpgradeDialog()
  const { redirecting, redirect } = useCheckoutRedirect()

  if (user === null || phase !== 'success' || plan === null) {
    // Loading/error must never break the header — the chip is a status
    // readout, not a gate. (The banner owns the failed_renewal alarm.)
    return null
  }

  const status = plan.status
  const renewsOn = plan.renews_on

  const freeVariant = status === null || status === 'expired'
  const buttonLike = freeVariant || status === 'cancelled' || status === 'failed_renewal'

  let label: React.ReactNode
  let ariaLabel: string | undefined
  const date = renewsOn !== null ? dateChunk(renewsOn, locale) : null

  if (freeVariant) {
    label = t('chip.free')
  } else if (status === 'active') {
    label = date !== null ? t.rich('chip.starter', date) : t('chip.starter')
  } else if (status === 'cancelled') {
    label = date !== null ? t.rich('plan.cancelled_title', date) : t('plan.cancelled_title')
  } else if (status === 'failed_renewal') {
    label = t('chip.failed')
    ariaLabel = t('chip.failed')
  } else {
    // Review P8: an unknown status renders nothing — never a mislabeled
    // action surface (the old else treated ANY unknown status as
    // failed_renewal).
    return null
  }

  const base =
    'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-small font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none md:h-7 md:min-h-7'

  if (!buttonLike) {
    return (
      <span data-testid="subscription-chip" className={cn(base, 'bg-primary text-primary-foreground')}>
        {label}
      </span>
    )
  }

  const onClick = () => {
    if (status === 'failed_renewal') {
      void redirect('subscription', SUBSCRIPTION_PRICE_DZD)
      return
    }
    // Manual-review fix: a cancelled user's dialog is a REACTIVATION offer
    // — open('reactivate') makes the dialog title read "Reactivate" (the
    // state-aware copy; the Subscribe CTA re-activates the same row).
    open(status === 'cancelled' ? 'reactivate' : 'upgrade')
  }

  return (
    <Button
      type="button"
      data-testid="subscription-chip"
      aria-label={ariaLabel}
      disabled={redirecting}
      aria-busy={redirecting}
      onClick={onClick}
      className={cn(
        base,
        'h-auto',
        freeVariant
          ? 'border border-primary bg-transparent text-primary hover:bg-primary/10'
          : 'bg-warning-container text-warning-on-container',
      )}
    >
      {label}
    </Button>
  )
}
