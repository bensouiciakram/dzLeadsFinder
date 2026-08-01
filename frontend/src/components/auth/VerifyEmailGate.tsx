'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'

export function VerifyEmailGate() {
  const t = useTranslations('auth.verify')
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) return
    setState('sending')
    try {
      const response = await fetch('/api/auth/resend-verification/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      setState(response.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
      <h1 className="text-title font-bold text-foreground">{t('gate_title')}</h1>
      <p className="mt-2 text-small text-muted-foreground">{t('gate_description')}</p>
      <p className="mt-2 text-small text-muted-foreground">{t('expiry_note')}</p>

      <form onSubmit={handleResend} noValidate className="mt-6 space-y-4">
        <div>
          <label htmlFor="verify-email" className="text-small font-medium text-foreground">
            {t('email_label')}
          </label>
          <input
            id="verify-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={state === 'error' ? 'verify-email-error' : undefined}
            aria-invalid={state === 'error'}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30"
          />
        </div>

        {state === 'sent' ? (
          <p role="status" className="text-small text-primary">
            {t('resend_success')}
          </p>
        ) : null}
        {state === 'error' ? (
          <p id="verify-email-error" role="alert" className="text-small text-destructive">
            {t('resend_failed')}
          </p>
        ) : null}

        <Button type="submit" disabled={state === 'sending'} className="w-full">
          {t('resend')}
        </Button>
      </form>
    </div>
  )
}
