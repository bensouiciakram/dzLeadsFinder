'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { isAxiosError } from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { FormErrorSummary } from './FormErrorSummary'
import { useSession } from '@/components/providers/SessionProvider'
import { TextInput } from '@/components/ui/input'
import { authService } from '@/lib/api/auth-service'
import { loginSchema, type LoginValues } from '@/lib/validation/auth'

export function LoginForm() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh } = useSession()
  const sessionExpired = searchParams.get('reason') === 'session_expired'
  const resetDone = searchParams.get('reason') === 'password_reset'
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    if (isSubmitting) return
    try {
      await authService.login(values.email, values.password)
      const result = await refresh()
      if (result === 'authenticated') {
        router.push('/')
      } else if (result === 'error') {
        setError('root', { message: 'common.errors.network' })
      }
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.status === 429) {
          setError('root', { message: 'auth.login.error_rate_limited' })
        } else if (error.response.status === 400) {
          setError('root', { message: 'auth.login.error_invalid' })
        } else {
          setError('root', { message: 'common.states.error' })
        }
      } else {
        setError('root', { message: 'common.errors.network' })
      }
    }
  }

  const summaryErrors = [
    errors.email?.message ? { id: 'login-email-error', message: errors.email.message } : null,
    errors.password?.message
      ? { id: 'login-password-error', message: errors.password.message }
      : null,
  ].filter((item): item is { id: string; message: string } => item !== null)

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {sessionExpired ? (
        <p role="alert" className="rounded-md border border-warning/30 bg-warning-container px-3 py-2 text-small">
          {t('auth.login.session_expired')}
        </p>
      ) : null}
      {resetDone ? (
        <p role="alert" className="rounded-md border border-success/30 bg-success-container px-3 py-2 text-small text-success-on-container">
          {t('auth.login.password_reset')}
        </p>
      ) : null}

      <div>
        <label htmlFor="login-email" className="text-small font-medium text-foreground">
          {t('auth.login.email_label')}
        </label>
        <TextInput
          id="login-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email')}
        />
        {errors.email?.message ? (
          <p id="login-email-error" tabIndex={-1} className="mt-1 text-small text-destructive">
            {t(errors.email.message)}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="login-password" className="text-small font-medium text-foreground">
          {t('auth.login.password_label')}
        </label>
        <TextInput
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...register('password')}
        />
        {errors.password?.message ? (
          <p id="login-password-error" tabIndex={-1} className="mt-1 text-small text-destructive">
            {t(errors.password.message)}
          </p>
        ) : null}
      </div>

      {errors.root?.message ? (
        <p role="alert" className="text-small text-destructive">
          {t(errors.root.message)}
        </p>
      ) : null}

      <FormErrorSummary errors={summaryErrors} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/password-reset" className="text-small text-primary underline-offset-4 hover:underline">
          {t('auth.login.forgot_password')}
        </Link>
        <Button type="submit" disabled={isSubmitting} className="px-5">
          {t('auth.login.submit')}
        </Button>
      </div>

      <p className="text-small text-muted-foreground">
        {t('auth.login.no_account')}{' '}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          {t('auth.login.signup_link')}
        </Link>
      </p>
    </form>
  )
}
