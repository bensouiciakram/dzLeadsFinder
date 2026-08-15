'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormErrorSummary } from './FormErrorSummary'
import { verifyEmailSchema, type VerifyEmailValues } from '@/lib/validation/auth'
import { authService } from '@/lib/api/auth-service'
import { isAxiosError } from 'axios'

type Props = { token: string }

type VerifyState =
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'already' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'error' }

export function VerifyLinkHandler({ token }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [state, setState] = useState<VerifyState>({ kind: 'loading' })
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: '' },
  })

  useEffect(() => {
    let cancelled = false

    async function verify() {
      try {
        const data = await authService.verifyEmail(token)
        if (cancelled) return
        setState(data.code === 'already_verified' ? { kind: 'already' } : { kind: 'success' })
      } catch (error) {
        if (cancelled) return
        if (isAxiosError(error) && error.response) {
          if (error.response.status === 400 || error.response.status === 404) {
            setState({ kind: 'expired' })
            return
          }
          if (error.response.status === 410) {
            setState((prev) =>
              prev.kind === 'success' || prev.kind === 'already' ? prev : { kind: 'used' },
            )
            return
          }
        }
        setState({ kind: 'error' })
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleResend(values: VerifyEmailValues) {
    setResendState('sending')
    try {
      await authService.resendVerification(values.email)
      setResendState('sent')
    } catch {
      setResendState('error')
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
      {state.kind === 'success' || state.kind === 'already' ? (
        <div>
          {state.kind === 'success' ? (
            <div role="status" className="rounded-md border border-primary/20 bg-primary/5 p-4">
              <h1 className="text-title font-bold text-foreground">
                {t('auth.verify.welcome_title')}
              </h1>
              <p className="mt-1 text-small text-muted-foreground tabular-nums">
                {t('auth.verify.welcome_description')}
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-title font-bold text-foreground">
                {t('auth.verify.already_verified')}
              </h1>
            </div>
          )}
          <Button onClick={() => router.push('/search')} className="mt-6 w-full">
            {t('auth.verify.start_search')}
          </Button>
        </div>
      ) : null}

      {state.kind === 'expired' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">
            {t('auth.verify.expired_title')}
          </h1>
          <p className="mt-2 text-small text-muted-foreground">
            {t('auth.verify.expired_description')}
          </p>
          <form onSubmit={handleSubmit(handleResend)} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="expired-email" className="text-small font-medium text-foreground">
                {t('auth.verify.email_label')}
              </label>
              <input
                id="expired-email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'expired-email-error' : undefined}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30"
                {...register('email')}
              />
              {errors.email?.message ? (
                <p id="expired-email-error" tabIndex={-1} className="mt-1 text-small text-destructive">
                  {t(errors.email.message)}
                </p>
              ) : null}
            </div>
            {resendState === 'sent' ? (
              <p role="status" className="text-small text-primary">
                {t('auth.verify.resend_success')}
              </p>
            ) : null}
            {resendState === 'error' ? (
              <p role="alert" className="text-small text-destructive">
                {t('auth.verify.resend_failed')}
              </p>
            ) : null}
            <FormErrorSummary
              errors={
                errors.email?.message
                  ? [{ id: 'expired-email-error', message: errors.email.message }]
                  : []
              }
            />
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {t('auth.verify.resend')}
            </Button>
          </form>
        </div>
      ) : null}

      {state.kind === 'used' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">{t('auth.verify.used_title')}</h1>
          <p className="mt-2 text-small text-muted-foreground">
            {t('auth.verify.used_description')}
          </p>
          <p className="mt-4 text-small text-foreground">{t('auth.verify.sign_in_prompt')}</p>
          <Link
            href="/login"
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t('common.nav.login')}
          </Link>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">{t('common.states.error')}</h1>
        </div>
      ) : null}
    </div>
  )
}
