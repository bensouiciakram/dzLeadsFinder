'use client'

import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { Button } from '@/components/ui/button'
import { useCheckoutRedirect } from '@/hooks/useCheckoutRedirect'
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
export type UpgradeDialogContextValue = {
  open: () => void
  close: () => void
  isOpen: boolean
}

const UpgradeDialogContext = createContext<UpgradeDialogContextValue | null>(null)

export function UpgradeDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  // Focus restore (Sally M4): capture the invoking control at open — no
  // ref plumbing across five entry points; every invoker (chip button,
  // PlanCard CTA, aria-disabled RevealControl, CreditsPill link, export
  // buttons) is focusable at click time. Base UI's finalFocus restores it
  // on close in the correct internal ordering (rAF-scheduled — the
  // DangerZone precedent).
  const lastFocusRef = useRef<HTMLElement | null>(null)

  const open = useCallback(() => {
    if (isOpen) {
      // open() while open is a no-op (double-click guard — Winston Q4).
      return
    }
    lastFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setIsOpen(true)
  }, [isOpen])

  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ open, close, isOpen }),
    [open, close, isOpen],
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
  const { isOpen, close } = useUpgradeDialog()
  const { redirecting, error, redirect } = useCheckoutRedirect()

  const subscribe = () => {
    void redirect('subscription', SUBSCRIPTION_PRICE_DZD)
  }

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(next) => { if (!next) close() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-dialog-backdrop
          className="fixed inset-0 z-50 bg-black/40"
        />
        <DialogPrimitive.Popup
          aria-modal="true"
          data-testid="upgrade-dialog"
          // Initial focus on the CTA (Sally M4) — Base UI schedules via rAF.
          initialFocus={() =>
            document.querySelector<HTMLElement>('[data-upgrade-subscribe]')
          }
          // Focus returns to the invoking control on close (AC; Sally M4 —
          // fall back to body when the host modal unmounted the control).
          finalFocus={() => {
            const target = lastFocusRef.current
            if (target !== null && document.contains(target)) return target
            return null
          }}
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-lg"
        >
          <DialogPrimitive.Title className="text-headline font-semibold text-foreground">
            {t('upgrade_dialog.title')}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            render={
              <button
                type="button"
                aria-label={actions('close')}
                className="absolute top-2 end-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>

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
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
