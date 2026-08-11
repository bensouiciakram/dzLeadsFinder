'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { Button } from '@/components/ui/button'
import { formatBillingDate, type PlanResult } from '@/lib/api/billing-service'
import type { BillingPhase } from '@/hooks/useBilling'

type CancelApi = {
  mutate: () => void
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  error: unknown
}

type Props = {
  plan: PlanResult | null
  phase: BillingPhase
  cancel: CancelApi
}

export function DangerZone({ plan, phase, cancel }: Props) {
  const t = useTranslations('billing')
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  // Close ONLY on success (review P2 — a synchronous close swallows the
  // failure: the user would believe they are cancelled while auto-renewal
  // continues, and the in-dialog error alert would be unreachable). On
  // failure the dialog stays open with the role=alert visible; the error
  // clears on the next attempt (react-query resets it on mutate).
  // Declared BEFORE the early return — hooks order is unconditional.
  useEffect(() => {
    if (cancel.isSuccess) {
      setOpen(false)
    }
  }, [cancel.isSuccess])

  // John V2 — the section renders ONLY for the active state (the amended
  // AC: "free users and all non-active states omit the section entirely").
  // failed_renewal is non-cancellable by design (the backend 409s it —
  // review P1: rendering the CTA there would be dead UI that can only fail;
  // the 5.7 banner owns that state's messaging). A cancelled/expired/free
  // user sees no Danger Zone at all (no dead UI — a cancel would 409).
  const cancellable = phase === 'success' && plan !== null && plan.status === 'active'

  if (!cancellable) {
    // John V2 — the section renders ONLY for cancellable states; free,
    // expired, failed_renewal and cancelled users see no Danger Zone (no
    // dead UI — a cancel there would 409).
    return null
  }

  const accessUntil = plan!.renews_on
  const dialogBody = accessUntil !== null ? (
    // Review P1 fix: next-intl v4 rich text — the date renders via a
    // <date>…</date> TAG whose chunks are the interpolated {d} value (the
    // 5.5-era {date}-value-with-function pattern rendered null in the real
    // formatter).
    t.rich('dzone.dialog_body', {
      date: (chunks) => (
        <bdi className="tabular-nums">{chunks}</bdi>
      ),
      d: formatBillingDate(accessUntil, locale, { withTime: false }),
    })
  ) : (
    t('dzone.dialog_body', { d: '' })
  )

  function confirmCancel() {
    cancel.mutate()
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-danger-container p-6 text-danger-on-container md:p-8">
      <h2 className="text-title font-semibold">{t('dzone.title')}</h2>
      <p className="mt-2 text-small text-danger-on-container">{t('dzone.description')}</p>
      <div className="mt-6">
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger
            render={<Button variant="destructive" className="px-5" />}
          >
            {t('dzone.cancel_button')}
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40" />
            <DialogPrimitive.Popup
              aria-modal="true"
              // Safe-control-first focus (EXPERIENCE L187: destructive
              // flows focus the safe control) — Base UI schedules this via
              // rAF (its default focus would land on the popup itself).
              initialFocus={() =>
                document.querySelector<HTMLElement>('[data-billing-keep]')
              }
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-lg md:p-8"
            >
              <DialogPrimitive.Title className="text-title font-semibold text-foreground">
                {t('dzone.dialog_title')}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-small text-muted-foreground">
                {dialogBody}
              </DialogPrimitive.Description>
              {cancel.isError ? (
                <p role="alert" className="mt-4 text-small text-destructive">
                  {t('dzone.error')}
                </p>
              ) : null}
              <div className="mt-6 flex justify-end gap-3">
                <DialogPrimitive.Close
                  render={
                    <Button
                      variant="outline"
                      className="px-5"
                      data-billing-keep="true"
                    />
                  }
                >
                  {t('dzone.keep')}
                </DialogPrimitive.Close>
                <Button
                  type="button"
                  variant="destructive"
                  className="px-5"
                  disabled={cancel.isPending}
                  onClick={confirmCancel}
                >
                  {cancel.isPending ? t('dzone.confirming') : t('dzone.confirm')}
                </Button>
              </div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </section>
  )
}

