'use client'

import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  formatBillingDate,
  numerals,
  SUBSCRIPTION_PRICE_DZD,
  type PlanResult,
} from '@/lib/api/billing-service'
import type { BillingPhase } from '@/hooks/useBilling'
import { useCheckoutRedirect } from '@/hooks/useCheckoutRedirect'

function dateChunk(iso: string, locale: string) {
  // A 0-arg RichTagsFunction (next-intl v3 types don't accept a ReactNode
  // value for {date}) â€” the renderer produces the bdi-isolated date.
  const formatted = formatBillingDate(iso, locale, { withTime: false })
  function DateChunk(): React.ReactNode {
    return <bdi className="tabular-nums">{formatted}</bdi>
  }
  DateChunk.displayName = 'PlanCardDateChunk'
  return DateChunk
}

type Props = {
  plan: PlanResult | null
  phase: BillingPhase
}

export function PlanCard({ plan, phase }: Props) {
  const t = useTranslations('billing')
  const states = useTranslations('common.states')
  const locale = useLocale()
  const { redirecting, error, redirect } = useCheckoutRedirect()

  if (phase === 'idle') {
    return null
  }

  if (phase === 'loading') {
    return (
      <section>
        <h2 className="text-headline font-semibold text-foreground">{t('current_plan')}</h2>
        <div className="mt-4 rounded-lg border border-border bg-card p-6">
          <p className="text-small text-muted-foreground">{states('loading')}</p>
        </div>
      </section>
    )
  }

  if (phase === 'error' || plan === null) {
    return (
      <section>
        <h2 className="text-headline font-semibold text-foreground">{t('current_plan')}</h2>
        <div className="mt-4 rounded-lg border border-border bg-card p-6">
          <p role="alert" className="text-small text-destructive">
            {states('error')}
          </p>
        </div>
      </section>
    )
  }

  const status = plan.status
  const renewsOn = plan.renews_on
  const subscriptionCredits = plan.balances.subscription_balance
  const displayCredits = plan.balances.display_balance

  // State driven by the SUBSCRIPTION status, never user.tier (5.5 D8 â€”
  // the 5.7 cancel sync owns the tier write; a cancelled user stays
  // tier='starter').
  let headline: React.ReactNode
  let creditsLabel: string
  let creditsValue: number
  let cta: 'upgrade' | 'reactivate' | 'retry_payment' | 'resubscribe' | null
  let announced = false

  if (status === null) {
    headline = t('plan.free_tier')
    creditsLabel = t('plan.credits')
    creditsValue = displayCredits
    cta = 'upgrade'
  } else if (status === 'active') {
    headline = t.rich('plan.starter_title', {
      date: renewsOn !== null ? dateChunk(renewsOn, locale) : '',
    })
    creditsLabel = t('plan.credits_cycle')
    creditsValue = subscriptionCredits
    cta = null
  } else if (status === 'failed_renewal') {
    headline = t.rich('plan.failed_title', {
      date: renewsOn !== null ? dateChunk(renewsOn, locale) : '',
    })
    creditsLabel = t('plan.credits_cycle')
    creditsValue = subscriptionCredits
    cta = 'retry_payment'
  } else if (status === 'cancelled') {
    headline = t.rich('plan.cancelled_title', {
      date: renewsOn !== null ? dateChunk(renewsOn, locale) : '',
    })
    creditsLabel = t('plan.credits_cycle')
    creditsValue = subscriptionCredits
    cta = 'reactivate'
    announced = true
  } else {
    headline = t('plan.expired_title')
    creditsLabel = t('plan.credits')
    creditsValue = displayCredits
    cta = 'resubscribe'
  }

  const ctaLabels: Record<NonNullable<typeof cta>, string> = {
    upgrade: t('plan.upgrade'),
    reactivate: t('plan.reactivate'),
    retry_payment: t('plan.retry_payment'),
    resubscribe: t('plan.resubscribe'),
  }

  return (
    <section>
      <h2 className="text-headline font-semibold text-foreground">{t('current_plan')}</h2>
      <div className="mt-4 rounded-lg border border-border bg-card p-6">
        {/* role=status wraps the headline text ONLY (ARIA 1.2: no focusable
            content inside a live region) â€” the cancelled flip announces
            "Cancelled â€” access until {date}" on the plan refetch. */}
        {announced ? (
          <p role="status" className="text-title font-semibold text-foreground">
            {headline}
          </p>
        ) : (
          <p className="text-title font-semibold text-foreground">{headline}</p>
        )}
        <p className="mt-2 text-small text-muted-foreground">{creditsLabel}</p>
        <p className="text-data tabular-nums text-foreground">
          <bdi>{numerals(creditsValue)}</bdi>
        </p>
        {cta !== null ? (
          <div className="mt-6">
            <Button
              type="button"
              className="min-h-11 px-5 md:h-8"
              disabled={redirecting}
              aria-busy={redirecting}
              onClick={() => void redirect('subscription', SUBSCRIPTION_PRICE_DZD)}
            >
              {redirecting ? t('packs.processing') : ctaLabels[cta]}
            </Button>
            {error ? (
              <p role="alert" className="mt-3 text-small text-destructive">
                {states('error')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
