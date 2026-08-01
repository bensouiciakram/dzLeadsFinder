'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { verifyEmailSchema, type VerifyEmailValues } from '@/lib/validation/auth'

export function VerifyEmailGate() {
  const t = useTranslations()
  const params = useSearchParams()
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: params.get('email') ?? '' },
  })

  async function onSubmit(values: VerifyEmailValues) {
    setState('sending')
    try {
      const response = await fetch('/api/auth/resend-verification/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      })
      setState(response.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
      <h1 className="text-title font-bold text-foreground">{t('auth.verify.gate_title')}</h1>
      <p className="mt-2 text-small text-muted-foreground">
        {t('auth.verify.gate_description')}
      </p>
      <p className="mt-2 text-small text-muted-foreground">{t('auth.verify.expiry_note')}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <div>
          <label htmlFor="verify-email" className="text-small font-medium text-foreground">
            {t('auth.verify.email_label')}
          </label>
          <input
            id="verify-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'verify-email-error' : undefined}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30"
            {...register('email')}
          />
          {errors.email?.message ? (
            <p id="verify-email-error" className="mt-1 text-small text-destructive">
              {t(errors.email.message)}
            </p>
          ) : null}
        </div>

        {state === 'sent' ? (
          <p role="status" className="text-small text-primary">
            {t('auth.verify.resend_success')}
          </p>
        ) : null}
        {state === 'error' ? (
          <p role="alert" className="text-small text-destructive">
            {t('auth.verify.resend_failed')}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {t('auth.verify.resend')}
        </Button>
      </form>
    </div>
  )
}
