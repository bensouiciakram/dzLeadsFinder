'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { isAxiosError } from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { authService } from '@/lib/api/auth-service'
import { newPasswordSchema, type NewPasswordValues } from '@/lib/validation/auth'

type Props = { token: string }

type ConfirmState =
  | { kind: 'loading' }
  | { kind: 'valid' }
  | { kind: 'done' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'error' }

export function PasswordResetConfirm({ token }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [state, setState] = useState<ConfirmState>({ kind: 'loading' })
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    let cancelled = false

    async function validate() {
      try {
        await authService.validatePasswordResetToken(token)
        if (!cancelled) setState({ kind: 'valid' })
      } catch (error) {
        if (cancelled) return
        if (isAxiosError(error) && error.response) {
          if (error.response.status === 410) {
            setState((prev) =>
              prev.kind === 'done' || prev.kind === 'valid' ? prev : { kind: 'used' },
            )
            return
          }
          setState({ kind: 'expired' })
          return
        }
        setState({ kind: 'error' })
      }
    }

    void validate()
    return () => {
      cancelled = true
    }
  }, [token])

  async function onSubmit(values: NewPasswordValues) {
    if (isSubmitting) return
    try {
      await authService.confirmPasswordReset(token, values.password)
      setState({ kind: 'done' })
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.status === 410) {
          setState((prev) => (prev.kind === 'done' ? prev : { kind: 'used' }))
          return
        }
        setState((prev) => (prev.kind === 'done' ? prev : { kind: 'expired' }))
        return
      }
      setState((prev) => (prev.kind === 'done' ? prev : { kind: 'error' }))
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30'

  if (state.kind === 'loading') {
    return (
      <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
        <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
      {state.kind === 'valid' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">
            {t('auth.password_reset.new_password_title')}
          </h1>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="reset-new-password"
                className="text-small font-medium text-foreground"
              >
                {t('auth.password_reset.new_password_label')}
              </label>
              <input
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? 'reset-new-password-error' : undefined
                }
                className={inputClass}
                {...register('password')}
              />
              {errors.password?.message ? (
                <p id="reset-new-password-error" className="mt-1 text-small text-destructive">
                  {t(errors.password.message)}
                </p>
              ) : null}
              <p className="mt-1 text-small text-muted-foreground">
                {t('auth.password_reset.password_requirements')}
              </p>
            </div>

            <div>
              <label
                htmlFor="reset-confirm-password"
                className="text-small font-medium text-foreground"
              >
                {t('auth.password_reset.confirm_password_label')}
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={
                  errors.confirmPassword ? 'reset-confirm-password-error' : undefined
                }
                className={inputClass}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword?.message ? (
                <p
                  id="reset-confirm-password-error"
                  className="mt-1 text-small text-destructive"
                >
                  {t(errors.confirmPassword.message)}
                </p>
              ) : null}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {t('auth.password_reset.submit_new')}
            </Button>
          </form>
        </div>
      ) : null}

      {state.kind === 'done' ? (
        <div>
          <p
            role="status"
            className="rounded-md border border-primary/20 bg-primary/5 p-4 text-small"
          >
            {t('auth.password_reset.reset_done')}
          </p>
          <Button
            onClick={() => router.push('/login?reason=password_reset')}
            className="mt-6 w-full"
          >
            {t('auth.password_reset.go_to_login')}
          </Button>
        </div>
      ) : null}

      {state.kind === 'expired' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">
            {t('auth.password_reset.expired_title')}
          </h1>
          <p className="mt-2 text-small text-muted-foreground">
            {t('auth.password_reset.expired_description')}
          </p>
          <Link
            href="/password-reset"
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t('auth.password_reset.request_new_link')}
          </Link>
        </div>
      ) : null}

      {state.kind === 'used' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">
            {t('auth.password_reset.used_title')}
          </h1>
          <p className="mt-2 text-small text-muted-foreground">
            {t('auth.password_reset.used_description')}
          </p>
          <Link
            href="/password-reset"
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t('auth.password_reset.request_new_link')}
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
