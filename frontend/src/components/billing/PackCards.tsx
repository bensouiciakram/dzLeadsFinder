'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { numerals, type PacksResult } from '@/lib/api/billing-service'
import type { BillingPhase } from '@/hooks/useBilling'
import { useCheckoutRedirect } from '@/hooks/useCheckoutRedirect'

type Props = {
  packs: PacksResult | null
  phase: BillingPhase
}

export function PackCards({ packs, phase }: Props) {
  const t = useTranslations('billing')
  const actions = useTranslations('common.actions')
  const states = useTranslations('common.states')
  const { redirecting, error, redirect } = useCheckoutRedirect()

  if (phase === 'idle') {
    return null
  }

  return (
    <section className="mt-8">
      <h2 className="text-headline font-semibold text-foreground">{t('packs.title')}</h2>
      {phase === 'loading' ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-6">
          <p className="text-small text-muted-foreground">{states('loading')}</p>
        </div>
      ) : phase === 'error' || packs === null ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-6">
          <p role="alert" className="text-small text-destructive">
            {states('error')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {packs.packs.map((pack) => (
              <div
                key={pack.amount}
                className="relative rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary md:p-8"
              >
                {pack.best_value ? (
                  <span className="absolute top-4 end-4 rounded-full bg-primary px-3 py-1 text-caption font-medium text-primary-foreground">
                    {t('packs.best_value')}
                  </span>
                ) : null}
                <p className="text-headline font-semibold tabular-nums text-foreground">
                  {numerals(pack.credits)}
                </p>
                <p className="mt-1 text-title font-semibold tabular-nums text-foreground">
                  {numerals(pack.amount)} {t('currency')}
                </p>
                <p className="mt-1 text-caption text-muted-foreground">
                  {t('packs.unit_price', { price: pack.unit_price })}
                </p>
                {pack.never_expires ? (
                  <p className="mt-3 flex items-center gap-1.5 text-small text-foreground">
                    {/* Manual-review fix: the 5.5-era literal `âœ“` (mojibake
                        ✓) is replaced with the lucide Check icon — the
                        UpgradeDialog/RecoveryDialog pattern. */}
                    <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                    {t('packs.never_expires')}
                  </p>
                ) : null}
                <div className="mt-6">
                  <Button
                    type="button"
                    className="w-full min-h-11 md:h-9"
                    disabled={redirecting}
                    aria-busy={redirecting}
                    onClick={() => void redirect('pack', pack.amount)}
                  >
                    {redirecting ? t('packs.processing') : actions('buy')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-small text-destructive">
              {states('error')}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
