'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/input'
import { FormErrorSummary } from './FormErrorSummary'
import { signupSchema, type SignupValues } from '@/lib/validation/auth'
import { authService, type SignupErrorBody } from '@/lib/api/auth-service'
import { isAxiosError } from 'axios'

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
      await authService.signup(values.email, values.password)
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`)
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.status === 400) {
          const data = error.response.data as SignupErrorBody
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
          if (
            !(data.email && data.email.length > 0) &&
            !(data.password && data.password.length > 0)
          ) {
            setError('root', { message: 'auth.signup.error_generic' })
          }
          return
        }
        setError('root', { message: 'auth.signup.error_generic' })
        return
      }
      setError('root', { message: 'common.errors.network' })
    }
  }

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
        <TextInput
          id="signup-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'signup-email-error' : undefined}
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
        <TextInput
          id="signup-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password
              ? 'signup-password-error signup-password-requirements'
              : 'signup-password-requirements'
          }
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
