'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Coins, TriangleAlert } from 'lucide-react'

import { useCredits } from '@/components/providers/CreditProvider'
import { useSession } from '@/components/providers/SessionProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function CreditsPill() {
  const t = useTranslations()
  const { user } = useSession()
  const { balance } = useCredits()
  const { toast } = useToast()
  const prevBalanceRef = useRef<number | null>(null)
  const userKeyRef = useRef<string | null>(null)
  const [announceDecrease, setAnnounceDecrease] = useState(false)

  useEffect(() => {
    // A user change (logout/login, or the 4.2 refresh-reconcile re-seeding
    // the provider from a fresh /me probe) must never read the previous
    // user's balance as a decrease: reset the diff baseline so the first
    // render of the new session is mount-like (no announcement).
    const userKey = user?.email ?? null
    if (userKey !== userKeyRef.current) {
      userKeyRef.current = userKey
      prevBalanceRef.current = balance
      setAnnounceDecrease(false)
      return
    }
    const prev = prevBalanceRef.current
    prevBalanceRef.current = balance
    if (prev === null || balance === null) {
      setAnnounceDecrease(false)
      return
    }
    setAnnounceDecrease(balance < prev)
  }, [balance, user])

  if (user === null || balance === null) return null

  const zeroCredits = balance === 0
  const warning = !zeroCredits && balance <= 10 && user.tier === 'starter'

  const announcement =
    announceDecrease ? t('common.credits.updated', { balance: String(balance) }) : ''

  const pill = (
    <Link
      href="/credits"
      data-testid="credits-pill"
      aria-label={
        warning
          ? `${t('common.credits.remaining', { count: String(balance) })} — ${t('common.credits.low_tooltip')}`
          : t('common.credits.remaining', { count: String(balance) })
      }
      onClick={(event) => {
        if (zeroCredits) {
          // Epic-5 recovery dialog stub (4.2 D9 precedent): the zero-state
          // click announces the recovery path instead of navigating.
          event.preventDefault()
          toast('common.credits.no_credits')
        }
      }}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none md:h-7 md:min-h-7',
        zeroCredits
          ? 'bg-danger-container text-danger-on-container'
          : warning
            ? 'bg-warning-container text-warning-on-container'
            : 'bg-muted text-foreground',
      )}
    >
      <Coins className="size-4 shrink-0" aria-hidden="true" />
      <span data-testid="credits-pill-balance" className="text-data font-semibold tabular-nums">
        {String(balance)}
      </span>
      {warning && (
        <TriangleAlert
          data-testid="credits-pill-warning-icon"
          className="size-4 shrink-0"
          aria-hidden="true"
        />
      )}
      <span data-testid="pill-announcer" role="status" className="sr-only">
        {announcement ?? ''}
      </span>
    </Link>
  )

  if (warning) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>{pill}</TooltipTrigger>
        <TooltipContent>{t('common.credits.low_tooltip')}</TooltipContent>
      </Tooltip>
    )
  }
  return pill
}
