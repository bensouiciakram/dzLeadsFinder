'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import { Button } from '@/components/ui/button'
import { useSession } from '@/components/providers/SessionProvider'
import { settingsService } from '@/lib/api/settings-service'

export function DangerZone() {
  const t = useTranslations()
  const locale = useLocale()
  const { status: sessionStatus, logout } = useSession()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<string | null>(null)

  if (sessionStatus === 'loading') {
    return null
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <section className="mt-8 rounded-lg border border-border bg-card p-6 md:p-8">
        <h2 className="text-title font-semibold text-foreground">{t('settings.guest_title')}</h2>
        <p className="mt-2 text-small text-muted-foreground">{t('settings.guest_body')}</p>
        <div className="mt-6">
          <Link
            href="/login"
            className="rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t('settings.guest_cta')}
          </Link>
        </div>
      </section>
    )
  }

  if (scheduledDate != null) {
    return (
      <section
        aria-live="polite"
        className="mt-8 rounded-lg border border-border bg-card p-6 md:p-8"
      >
        <h2 className="text-title font-semibold text-foreground">{t('settings.dzone.confirmed_title')}</h2>
        <p className="mt-2 text-small text-muted-foreground">
          {t('settings.dzone.confirmed_body', { date: scheduledDate })}
        </p>
        <div className="mt-6">
          <Button type="button" variant="outline" className="px-5" onClick={() => void logout()}>
            {t('settings.dzone.confirmed_logout')}
          </Button>
        </div>
      </section>
    )
  }

  async function confirmDeletion() {
    if (submitting) return
    setSubmitting(true)
    setError(false)
    try {
      const data = await settingsService.deleteAccount()
      setScheduledDate(
        new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          numberingSystem: 'latn',
        }).format(new Date(data.deletion_scheduled_at)),
      )
      setOpen(false)
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setStep(1)
      setError(false)
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-danger-container p-6 text-danger-on-container md:p-8">
      <h2 className="text-title font-semibold">{t('settings.dzone.title')}</h2>
      <p className="mt-2 text-small text-muted-foreground">{t('settings.dzone.description')}</p>
      <div className="mt-6">
        <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
          <DialogPrimitive.Trigger
            render={<Button variant="destructive" className="px-5" />}
          >
            {t('settings.dzone.delete_button')}
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40" />
            <DialogPrimitive.Popup
              aria-modal="true"
              className="fixed start-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-lg md:p-8"
            >
              {step === 1 ? (
                <>
                  <DialogPrimitive.Title className="text-title font-semibold text-foreground">
                    {t('settings.dzone.dialog_title')}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-2 text-small text-muted-foreground">
                    {t('settings.dzone.step1_intro')}
                  </DialogPrimitive.Description>
                  <ul className="mt-4 space-y-2 text-small text-foreground">
                    <li>{t('settings.dzone.consequence_frozen')}</li>
                    <li>{t('settings.dzone.consequence_permanent')}</li>
                    <li>{t('settings.dzone.consequence_credits')}</li>
                    <li>{t('settings.dzone.consequence_ledger')}</li>
                  </ul>
                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <DialogPrimitive.Close
                      render={<Button variant="outline" className="w-full px-5 sm:w-auto" />}
                    >
                      {t('common.actions.cancel')}
                    </DialogPrimitive.Close>
                    <Button type="button" className="w-full px-5 sm:w-auto" onClick={() => setStep(2)}>
                      {t('common.actions.continue')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <DialogPrimitive.Title className="text-title font-semibold text-foreground">
                    {t('settings.dzone.step2_title')}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-2 text-small text-muted-foreground">
                    {t('settings.dzone.step2_intro')}
                  </DialogPrimitive.Description>
                  {error ? (
                    <p role="alert" className="mt-4 text-small text-destructive">
                      {t('settings.dzone.confirm_error')}
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <DialogPrimitive.Close
                      render={<Button variant="outline" className="w-full px-5 sm:w-auto" />}
                    >
                      {t('common.actions.cancel')}
                    </DialogPrimitive.Close>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full px-5 sm:w-auto"
                      disabled={submitting}
                      onClick={() => void confirmDeletion()}
                    >
                      {submitting ? t('settings.dzone.confirming') : t('settings.dzone.confirm')}
                    </Button>
                  </div>
                </>
              )}
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </section>
  )
}
