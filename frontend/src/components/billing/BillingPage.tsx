'use client'

import { useTranslations } from 'next-intl'

import { PlanCard } from '@/components/billing/PlanCard'
import { PackCards } from '@/components/billing/PackCards'
import { PaymentHistoryTable } from '@/components/billing/PaymentHistoryTable'
import { DangerZone } from '@/components/billing/DangerZone'
import { useSession } from '@/components/providers/SessionProvider'
import { useBilling } from '@/hooks/useBilling'

export function BillingPage() {
  const t = useTranslations('billing')
  const { user } = useSession()
  const { plan, packs, history, planPhase, packsPhase, historyPhase, cancel } =
    useBilling({ user })

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <h1 className="text-display font-bold">{t('title')}</h1>
      <div className="mt-8 space-y-8">
        <PlanCard plan={plan} phase={planPhase} />
        <PackCards packs={packs} phase={packsPhase} />
        <PaymentHistoryTable history={history} phase={historyPhase} />
        <DangerZone plan={plan} phase={planPhase} cancel={cancel} />
      </div>
    </main>
  )
}
