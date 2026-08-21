'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { Button } from '@/components/ui/button'
import { DialogCloseX, ModalPanel } from '@/components/ui/dialog'
import { useCheckoutRedirect } from '@/hooks/useCheckoutRedirect'
import { useFocusRestore } from '@/hooks/useFocusRestore'
import { SUBSCRIPTION_PRICE_DZD } from '@/lib/api/billing-service'

// The single Upgrade Dialog (5.7 AC — "the same single Upgrade Dialog
// opens" from every upgrade CTA). Winston Q4 ruling: a context provider
// mounted in Providers.tsx (the Session/Locale/Toast/Credit pattern) with
// ONE dialog instance portal-rendered from inside the provider. Every
// entry point (header chip, 0-credit recovery, watermark modal, xlsx
// tooltip, search daily-limit) calls open() — no per-page instances.
//
// The dialog is the SOLE subscription conversion surface (John V8): no
// public pricing page dependency; every state (free/expired/cancelled)
// funnels through the same Subscribe CTA — the backend's state handling
// (create-checkout 409 blocks only ACTIVE; cancelled/expired/failed
// re-activation) makes that correct. On close the user is never
// redirected (AC) — only the CTA navigates via useCheckoutRedirect
// (stash-before-assign for the 5.6 return flow).
//
// Manual-review fix (deferred-work): the title is state-aware. The only
// dialog trigger that means REACTIVATION (not upgrade) is the cancelled
// chip — it calls open('reactivate') and the title reads the existing
// `plan.reactivate` string ("Reactivate" ×3) instead of "Upgrade to
// Starter" (zero new i18n keys — Sally's reuse-first discipline).
type UpgradeIntent = 'upgrade' | 'reactivate'

type UpgradeDialogContextValue = {
  open: (intent?: UpgradeIntent) => void
  close: () => void
  isOpen: boolean
  intent: UpgradeIntent
}

const UpgradeDialogContext = createContext<UpgradeDialogContextValue | null>(null)

export function UpgradeDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [intent, setIntent] = useState<UpgradeIntent>('upgrade')
  // Focus restore (Sally M4): capture the invoking control at open — no
  // ref plumbing across five entry points; every invoker (chip button,
  // PlanCard CTA, aria-disabled RevealControl, CreditsPill link, export
  // buttons) is focusable at click time. Base UI's finalFocus restores it
  // on close in the correct internal ordering (rAF-scheduled — the
  // DangerZone precedent).
  const { lastFocusRef, captureFocus } = useFocusRestore()
  // M7: the double-click guard must NOT read the state in the callback's
  // closure — `[isOpen]` in the deps made open() a NEW identity on every
  // dialog flip, so every consumer effect depending on it (ExportModal's
  // upgrade re-point) re-fired when the user closed and reopened the
  // dialog. The ref mirrors the state one-way (set in the only two places
  // that transition it), keeping the guard AND a stable identity (deps []).
  const isOpenRef = useRef(false)

  const open = useCallback(
    (nextIntent: UpgradeIntent = 'upgrade') => {
      if (isOpenRef.current) {
        // open() while open is a no-op (double-click guard — Winston Q4).
        return
      }
      isOpenRef.current = true
      captureFocus()
      setIntent(nextIntent)
      setIsOpen(true)
    },
    [captureFocus],
  )

  const close = useCallback(() => {
    isOpenRef.current = false
    setIsOpen(false)
  }, [])

  const value = useMemo(
    () => ({ open, close, isOpen, intent }),
    [open, close, isOpen, intent],
  )

  return (
    <UpgradeDialogContext.Provider value={value}>
      {children}
      <UpgradeDialogBody lastFocusRef={lastFocusRef} />
    </UpgradeDialogContext.Provider>
  )
}

export function useUpgradeDialog(): UpgradeDialogContextValue {
  const ctx = useContext(UpgradeDialogContext)
  if (ctx === null) {
    throw new Error('useUpgradeDialog must be used within UpgradeDialogProvider')
  }
  return ctx
}

function UpgradeDialogBody({
  lastFocusRef,
}: {
  lastFocusRef: React.RefObject<HTMLElement | null>
}) {
  const t = useTranslations('billing')
  const trust = useTranslations('trust.homepage')
  const actions = useTranslations('common.actions')
  const states = useTranslations('common.states')
  const { isOpen, close, intent } = useUpgradeDialog()
  const { finalFocus } = useFocusRestore(lastFocusRef)
  const { redirecting, error, redirect } = useCheckoutRedirect()

  const subscribe = () => {
    void redirect('subscription', SUBSCRIPTION_PRICE_DZD)
  }

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(next) => { if (!next) close() }}>
      <ModalPanel
        testid="upgrade-dialog"
        backdropProps={{ 'data-dialog-backdrop': true }}
        // Initial focus on the CTA (Sally M4) — Base UI schedules via rAF.
        initialFocus={() =>
          document.querySelector<HTMLElement>('[data-upgrade-subscribe]')
        }
        finalFocus={finalFocus}
      >
          <DialogPrimitive.Title className="text-headline font-semibold text-foreground">
            {/* Manual-review fix: state-aware title — a cancelled user's
                dialog means REACTIVATION (the Subscribe CTA re-activates
                the same row); the existing `plan.reactivate` string is
                reused (zero new i18n keys). */}
            {intent === 'reactivate' ? t('plan.reactivate') : t('upgrade_dialog.title')}
          </DialogPrimitive.Title>
          <DialogCloseX label={actions('close')} />

          <div className="mt-4">
            <p className="text-headline font-semibold tabular-nums text-foreground">
              {t('upgrade_dialog.credits')}
            </p>
            <p className="text-title font-semibold tabular-nums text-foreground">
              {t('upgrade_dialog.price')}
            </p>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {(['starter_feature_1', 'starter_feature_2', 'starter_feature_3'] as const).map(
              (feature) => (
                <li key={feature} className="flex items-center gap-2 text-small text-foreground">
                  <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                  {trust(feature)}
                </li>
              ),
            )}
          </ul>

          {error ? (
            <p role="alert" className="mt-4 text-small text-destructive">
              {states('error')}
            </p>
          ) : null}

          <Button
            type="button"
            data-upgrade-subscribe
            className="mt-6 w-full"
            disabled={redirecting}
            aria-busy={redirecting}
            onClick={subscribe}
          >
            {redirecting ? t('packs.processing') : t('upgrade_dialog.cta')}
          </Button>
        </ModalPanel>
    </DialogPrimitive.Root>
  )
}
