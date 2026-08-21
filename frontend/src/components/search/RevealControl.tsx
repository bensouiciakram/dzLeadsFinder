'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useSession } from '@/components/providers/SessionProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { useUpgradeDialog } from '@/components/providers/UpgradeDialogProvider'
import { useRecoveryDialog } from '@/components/providers/RecoveryDialogProvider'
import { usePlan } from '@/hooks/usePlan'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useReveal } from '@/hooks/useReveal'
import { useRevealState } from '@/hooks/useRevealState'
import type { RevealInFlight } from '@/lib/reveal/reveal-cache'
import { revealKeys } from '@/lib/queryKeys/reveal'
import { cn } from '@/lib/utils'
import type { CompanyResultRow, PeopleResultRow, SearchTab } from '@/lib/api/search-service'

export function RevealControl({
  tab,
  row,
}: {
  tab: SearchTab
  row: PeopleResultRow | CompanyResultRow
}) {
  const t = useTranslations()
  const state = useRevealState({ tab, row })
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useSession()
  const { open: openUpgradeDialog } = useUpgradeDialog()
  const { open: openRecoveryDialog } = useRecoveryDialog()
  // Review P5 (5.7 full review): dispatch on the plan query's tier (fresh
  // via the window-focus refetch) with the session fallback — the expiry
  // sync never refreshes the open tab's session.
  const { plan } = usePlan({ user })
  const dispatchTier = plan?.tier ?? user?.tier
  const { reveal } = useReveal()

  const handleClick = () => {
    // Synchronous read — onMutate wrote the flag during the first click's
    // event handler; a second click in the same tick must be ignored even
    // before the reactive state re-renders.
    const inFlight = queryClient.getQueryData<RevealInFlight>(revealKeys.inFlight)
    if (inFlight !== null && inFlight !== undefined) return
    if (state.zeroCredits) {
      // 5.7 (John V1 amendment 3 — the AC's "0-credit recovery" entry):
      // the aria-disabled reveal dispatches by the entitlement tier —
      // free → the Upgrade Dialog, Starter → the RecoveryDialog top-up
      // (the 4.2 D9 stub resolved; the disabled-but-actionable primitive).
      if (dispatchTier === 'free') {
        openUpgradeDialog()
      } else {
        openRecoveryDialog()
      }
      return
    }
    // Offline fail-fast (deferred-work manual-testing fix): the POST would
    // hang until the 20s timeout (or indefinitely) — surface the failure
    // surface immediately instead of stranding the spinner.
    if (navigator.onLine === false) {
      toast('search.reveal.failed')
      return
    }
    reveal
      .mutateAsync({ type: state.recordType, id: state.rowId })
      .catch(() => {
        toast('search.reveal.failed')
      })
  }

  if (state.revealed) {
    return (
      <span
        data-testid="reveal-badge"
        className="inline-flex items-center rounded-full bg-success-container px-3 py-1 text-caption font-medium text-success-on-container"
      >
        {t('search.reveal.already_revealed')}
      </span>
    )
  }

  const button = (
    <button
      type="button"
      data-testid="reveal-slot"
      aria-expanded={state.showRegion}
      aria-controls={state.regionId}
      aria-busy={state.pending || undefined}
      aria-disabled={state.zeroCredits || undefined}
      onClick={handleClick}
      className={cn(
        'flex w-full min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-center text-small font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8',
        state.zeroCredits
          ? 'border border-border bg-muted text-muted-strong'
          : 'bg-primary text-primary-foreground',
      )}
    >
      {state.pending ? (
        <>
          <Loader2 data-testid="reveal-spinner" className="size-4 animate-spin" />
          <span className="sr-only">{t('common.actions.reveal')}</span>
        </>
      ) : (
        <>
          <span className="min-w-0 whitespace-nowrap">{t('common.actions.reveal')}</span>
          <span className="min-w-0 whitespace-nowrap opacity-80">{t('search.reveal.cost')}</span>
        </>
      )}
    </button>
  )

  if (state.zeroCredits) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="block" />}>{button}</TooltipTrigger>
        <TooltipContent>{t('search.reveal.no_credits')}</TooltipContent>
      </Tooltip>
    )
  }
  return button
}
