'use client'

import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { Button } from '@/components/ui/button'
import { useSession } from '@/components/providers/SessionProvider'
import { usePacks } from '@/hooks/usePacks'
import { useCheckoutRedirect } from '@/hooks/useCheckoutRedirect'
import { numerals } from '@/lib/api/billing-service'

// The Starter 0-credit recovery surface (5.7 — John V1 ruling): the
// "0-credit recovery" entry point dispatches by user.tier — free users →
// the Upgrade Dialog; Starter users → THIS dialog (the top-up surface
// embedding the two add-on pack purchase paths via the shared
// create-checkout pack flow — never the Upgrade Dialog, whose Subscribe
// CTA the 409 would reject for an active subscriber). The 4.2 D9 recovery
// stubs resolve for BOTH user types.
//
// Sally M1: ZERO new message keys — title = billing.packs.title, pack
// cards reuse packs.* + common.actions.buy + common.actions.close.
type RecoveryDialogContextValue = {
  open: () => void
  close: () => void
  isOpen: boolean
}

const RecoveryDialogContext = createContext<RecoveryDialogContextValue | null>(null)

export function RecoveryDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const lastFocusRef = useRef<HTMLElement | null>(null)

  const open = useCallback(() => {
    if (isOpen) return
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
    <RecoveryDialogContext.Provider value={value}>
      {children}
      <RecoveryDialogBody lastFocusRef={lastFocusRef} />
    </RecoveryDialogContext.Provider>
  )
}

export function useRecoveryDialog(): RecoveryDialogContextValue {
  const ctx = useContext(RecoveryDialogContext)
  if (ctx === null) {
    throw new Error('useRecoveryDialog must be used within RecoveryDialogProvider')
  }
  return ctx
}

function RecoveryDialogBody({
  lastFocusRef,
}: {
  lastFocusRef: React.RefObject<HTMLElement | null>
}) {
  const t = useTranslations('billing')
  const actions = useTranslations('common.actions')
  const states = useTranslations('common.states')
  const { isOpen, close } = useRecoveryDialog()
  const { user } = useSession()
  const { packs, phase } = usePacks({ user, isOpen })
  const { redirecting, error, redirect } = useCheckoutRedirect()

  // The pack table loads ASYNC — Base UI's initialFocus ran at open while
  // the content was still the loading line (no Buy to focus). When the
  // packs land, move focus to the first Buy (the safe control — Sally M4).
  // Review P8 (5.7 full review): never clobber a focus the USER placed —
  // if the active element is already one of the Buy buttons, leave it.
  useEffect(() => {
    if (isOpen && phase === 'success') {
      const active = document.activeElement
      const onBuy =
        active instanceof HTMLElement &&
        active.closest('[data-recovery-buy]') !== null
      if (!onBuy) {
        document.querySelector<HTMLElement>('[data-recovery-first-buy]')?.focus()
      }
    }
  }, [isOpen, phase])

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(next) => { if (!next) close() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-recovery-backdrop
          className="fixed inset-0 z-50 bg-black/40"
        />
        <DialogPrimitive.Popup
          aria-modal="true"
          data-testid="recovery-dialog"
          initialFocus={() =>
            document.querySelector<HTMLElement>('[data-recovery-first-buy]')
          }
          finalFocus={() => {
            const target = lastFocusRef.current
            if (target !== null && document.contains(target)) return target
            return null
          }}
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-lg"
        >
          <DialogPrimitive.Title className="text-headline font-semibold text-foreground">
            {t('packs.title')}
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

          {phase === 'loading' ? (
            <p className="mt-4 text-small text-muted-foreground">{states('loading')}</p>
          ) : phase === 'error' || packs === null ? (
            <p role="alert" className="mt-4 text-small text-destructive">
              {states('error')}
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {packs.packs.map((pack, index) => (
                <div
                  key={pack.amount}
                  className="rounded-lg border border-border bg-card p-4"
                >
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
                      <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                      {t('packs.never_expires')}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    data-recovery-buy
                    data-recovery-first-buy={index === 0 ? 'true' : undefined}
                    className="mt-4 w-full"
                    disabled={redirecting}
                    aria-busy={redirecting}
                    onClick={() => void redirect('pack', pack.amount)}
                  >
                    {redirecting ? t('packs.processing') : actions('buy')}
                  </Button>
                </div>
              ))}
              {error ? (
                <p role="alert" className="text-small text-destructive">
                  {states('error')}
                </p>
              ) : null}
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
