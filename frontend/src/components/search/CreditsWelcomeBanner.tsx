'use client'

import { useTranslations } from 'next-intl'
import { Gift, X } from 'lucide-react'

import { useCredits } from '@/components/providers/CreditProvider'
import { useSession } from '@/components/providers/SessionProvider'
import { useCreditsBanner } from '@/hooks/useCreditsBanner'
import { useCreditsBannerMutations } from '@/hooks/useCreditsBannerMutations'

export function CreditsWelcomeBanner() {
  const t = useTranslations()
  const { user } = useSession()
  const { balance } = useCredits()
  const { dismissed, phase } = useCreditsBanner({ user })
  const { dismiss } = useCreditsBannerMutations()

  if (user === null) return null
  if (user.tier !== 'free') return null
  if (balance === null || balance <= 0) return null
  // Render only once the dismissal state is KNOWN: while the query is
  // loading or failed, `dismissed` defaults to false — showing the strip
  // then would flash the banner to users who already dismissed it, and an
  // error would re-show it to them.
  if (phase !== 'success') return null
  if (dismissed) return null

  return (
    <div
      data-testid="credits-banner"
      className="mb-3 flex items-center gap-2 rounded-md bg-info-container px-4 py-2 text-small text-info-on-container"
    >
      <Gift className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {t('common.credits.banner_welcome', { count: String(balance) })}
      </span>
      <button
        type="button"
        aria-label={t('common.actions.close')}
        disabled={dismiss.isPending}
        onClick={() => dismiss.mutate()}
        className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-md text-info-on-container hover:bg-info-on-container/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
