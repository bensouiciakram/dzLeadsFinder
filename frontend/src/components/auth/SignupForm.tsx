'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { FormErrorSummary } from './FormErrorSummary'
import { signupSchema, type SignupValues } from '@/lib/validation/auth'

type ServerErrorBody = {
  email?: string[]
  password?: string[]
  code?: { email?: string[] }
}

export function SignupForm() {
  const t = useTranslations()
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: SignupValues) {
    if (isSubmitting) return
    try {
      const response = await fetch('/api/auth/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      })
      if (response.ok) {
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`)
        return
      }
      if (response.status === 400) {
        let data: ServerErrorBody = {}
        try {
          data = (await response.json()) as ServerErrorBody
        } catch {
          setError('root', { message: 'auth.signup.error_generic' })
          return
        }
        if (data.email && data.email.length > 0) {
          setError('email', {
            type: 'server',
            message:
              data.code?.email?.[0] === 'email_taken'
                ? 'auth.signup.error_email_taken'
                : 'common.errors.invalid_email',
          })
        }
        if (data.password && data.password.length > 0) {
          setError('password', { type: 'server', message: 'auth.signup.error_weak_password' })
        }
        if (!(data.email && data.email.length > 0) && !(data.password && data.password.length > 0)) {
          setError('root', { message: 'auth.signup.error_generic' })
        }
        return
      }
      setError('root', { message: 'auth.signup.error_generic' })
    } catch {
      setError('root', { message: 'common.errors.network' })
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30'

  const summaryErrors = [
    errors.email?.message ? { id: 'signup-email-error', message: errors.email.message } : null,
    errors.password?.message
      ? { id: 'signup-password-error', message: errors.password.message }
      : null,
  ].filter((item): item is { id: string; message: string } => item !== null)

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div>
        <label htmlFor="signup-email" className="text-small font-medium text-foreground">
          {t('auth.signup.email_label')}
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'signup-email-error' : undefined}
          className={inputClass}
          {...register('email')}
        />
        {errors.email?.message ? (
          <p id="signup-email-error" tabIndex={-1} className="mt-1 text-small text-destructive">
            {t(errors.email.message)}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="signup-password" className="text-small font-medium text-foreground">
          {t('auth.signup.password_label')}
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password
              ? 'signup-password-error signup-password-requirements'
              : 'signup-password-requirements'
          }
          className={inputClass}
          {...register('password')}
        />
        {errors.password?.message ? (
          <p id="signup-password-error" tabIndex={-1} className="mt-1 text-small text-destructive">
            {t(errors.password.message)}
          </p>
        ) : null}
        <p id="signup-password-requirements" className="mt-1 text-small text-muted-foreground">
          {t('auth.signup.password_requirements')}
        </p>
      </div>

      <FormErrorSummary errors={summaryErrors} />

      {errors.root?.message ? (
        <p role="alert" className="text-small text-destructive">
          {t(errors.root.message)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-small text-muted-foreground">
          {t('auth.signup.no_card_required')}
        </span>
        <Button type="submit" disabled={isSubmitting} className="px-5">
          {t('auth.signup.submit')}
        </Button>
      </div>

      <p className="text-small text-muted-foreground">
        {t('auth.signup.has_account')}{' '}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          {t('auth.signup.login_link')}
        </Link>
      </p>
    </form>
  )
}
