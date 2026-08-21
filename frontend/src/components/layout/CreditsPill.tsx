'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Coins, TriangleAlert } from 'lucide-react'

import { useCredits } from '@/components/providers/CreditProvider'
import { useSession } from '@/components/providers/SessionProvider'
import { useUpgradeDialog } from '@/components/providers/UpgradeDialogProvider'
import { useRecoveryDialog } from '@/components/providers/RecoveryDialogProvider'
import { useDispatchTier } from '@/hooks/useDispatchTier'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function CreditsPill() {
  const t = useTranslations()
  const { user } = useSession()
  const { balance, baselineNonce } = useCredits()
  const { open: openUpgradeDialog } = useUpgradeDialog()
  const { open: openRecoveryDialog } = useRecoveryDialog()
  const dispatchTier = useDispatchTier()
  const prevBalanceRef = useRef<number | null>(null)
  const userKeyRef = useRef<string | null>(null)
  const nonceRef = useRef<number>(baselineNonce)
  // 5.6 review P1: the baseline reset must land on the GRANT-ANNOUNCED
  // balance, not the pre-grant one. The StatusCard bumps the nonce and
  // refreshes the session in the same effect — the new balance arrives a
  // frame later via the async /me probe. Capturing at the nonce frame
  // would diff the grant balance against the pre-grant baseline and fire
  // the false DECREASE the handoff was built to prevent. The pending
  // marker defers the capture to the next balance-change frame.
  const pendingResetRef = useRef(false)
  const [announceDecrease, setAnnounceDecrease] = useState(false)

  useEffect(() => {
    // 5.6 (Sally's pill-trap handoff): the status-card success flow bumps
    // the baseline nonce — the grant-announced balance update (e.g. a
    // renewal's pool math 250 → 200) must be treated mount-like, never as
    // a spend decrease.
    if (baselineNonce !== nonceRef.current) {
      nonceRef.current = baselineNonce
      pendingResetRef.current = true
      setAnnounceDecrease(false)
      return
    }
    if (pendingResetRef.current) {
      // The grant-announced balance has landed — capture IT as the fresh
      // baseline (review P1: never the pre-grant value).
      pendingResetRef.current = false
      prevBalanceRef.current = balance
      setAnnounceDecrease(false)
      return
    }
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
  }, [balance, user, baselineNonce])

  if (user === null || balance === null) return null

  const zeroCredits = balance === 0
  const warning = !zeroCredits && balance <= 10 && dispatchTier === 'starter'

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
          // 5.7 (John V1 amendment 3 — the AC's "0-credit recovery"
          // entry): the zero-state click dispatches by the entitlement
          // tier. Free users → the single Upgrade Dialog. Starter users →
          // the RecoveryDialog top-up surface (the 4.2 D9 stub resolved).
          event.preventDefault()
          if (dispatchTier === 'free') {
            openUpgradeDialog()
            return
          }
          openRecoveryDialog()
        }
      }}
      className={cn(
        // Manual-review polish: the 44px mobile tap target stays (the AA
        // floor) but the geometry tightens — px-2.5/gap-1 on mobile so the
        // pill doesn't read as an oversized blob next to the 28px chip;
        // desktop keeps the DESIGN.md 28px/pill proportions (h-7, px-3).
        'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none md:h-7 md:min-h-7 md:gap-1.5 md:px-3',
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
