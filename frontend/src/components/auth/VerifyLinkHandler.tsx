'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'

type Props = { token: string }

type VerifyState =
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'already' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'error' }

export function VerifyLinkHandler({ token }: Props) {
  const t = useTranslations('auth.verify')
  const common = useTranslations('common')
  const router = useRouter()
  const [state, setState] = useState<VerifyState>({ kind: 'loading' })
  const [email, setEmail] = useState('')
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    let cancelled = false

    async function verify() {
      try {
        const response = await fetch(`/api/auth/verify-email/${encodeURIComponent(token)}/`)
        if (cancelled) return
        if (response.status === 200) {
          const data = (await response.json()) as { code?: string }
          setState(data.code === 'already_verified' ? { kind: 'already' } : { kind: 'success' })
          return
        }
        if (response.status === 400 || response.status === 404) {
          setState({ kind: 'expired' })
          return
        }
        if (response.status === 410) {
          setState({ kind: 'used' })
          return
        }
        setState({ kind: 'error' })
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) return
    setResendState('sending')
    try {
      const response = await fetch('/api/auth/resend-verification/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      setResendState(response.ok ? 'sent' : 'error')
    } catch {
      setResendState('error')
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="text-small text-muted-foreground">{common('states.loading')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
      {state.kind === 'success' || state.kind === 'already' ? (
        <div>
          {state.kind === 'success' ? (
            <div
              role="status"
              className="rounded-md border border-primary/20 bg-primary/5 p-4"
            >
              <h1 className="text-title font-bold text-foreground">{t('welcome_title')}</h1>
              <p className="mt-1 text-small text-muted-foreground tabular-nums">
                {t('welcome_description')}
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-title font-bold text-foreground">{t('already_verified')}</h1>
            </div>
          )}
          <Button onClick={() => router.push('/search')} className="mt-6 w-full">
            {t('start_search')}
          </Button>
        </div>
      ) : null}

      {state.kind === 'expired' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">{t('expired_title')}</h1>
          <p className="mt-2 text-small text-muted-foreground">{t('expired_description')}</p>
          <form onSubmit={handleResend} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="expired-email" className="text-small font-medium text-foreground">
                {t('email_label')}
              </label>
              <input
                id="expired-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={resendState === 'error' ? 'expired-email-error' : undefined}
                aria-invalid={resendState === 'error'}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30"
              />
            </div>
            {resendState === 'sent' ? (
              <p role="status" className="text-small text-primary">
                {t('resend_success')}
              </p>
            ) : null}
            {resendState === 'error' ? (
              <p id="expired-email-error" role="alert" className="text-small text-destructive">
                {t('resend_failed')}
              </p>
            ) : null}
            <Button type="submit" disabled={resendState === 'sending'} className="w-full">
              {t('resend')}
            </Button>
          </form>
        </div>
      ) : null}

      {state.kind === 'used' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">{t('used_title')}</h1>
          <p className="mt-2 text-small text-muted-foreground">{t('used_description')}</p>
          <p className="mt-4 text-small text-foreground">{t('sign_in_prompt')}</p>
          <Link
            href="/login"
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {common('nav.login')}
          </Link>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">{common('states.error')}</h1>
        </div>
      ) : null}
    </div>
  )
}
