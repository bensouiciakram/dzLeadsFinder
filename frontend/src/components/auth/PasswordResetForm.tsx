'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { isAxiosError } from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { authService } from '@/lib/api/auth-service'
import { passwordResetSchema, type PasswordResetValues } from '@/lib/validation/auth'

export function PasswordResetForm() {
  const t = useTranslations()
  const [submitted, setSubmitted] = useState(false)
  const submittingRef = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: PasswordResetValues) {
    if (submittingRef.current || isSubmitting) return
    submittingRef.current = true
    try {
      await authService.requestPasswordReset(values.email)
      setSubmitted(true)
    } catch (error) {
      if (isAxiosError(error)) {
        setError('root', { message: 'common.states.error' })
      } else {
        setError('root', { message: 'common.errors.network' })
      }
    } finally {
      submittingRef.current = false
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30'

  if (submitted) {
    return (
      <div>
        <p role="status" className="rounded-md border border-primary/20 bg-primary/5 p-4 text-small">
          {t('auth.password_reset.sent_confirmation')}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {t('common.nav.login')}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div>
        <label htmlFor="reset-email" className="text-small font-medium text-foreground">
          {t('auth.password_reset.email_label')}
        </label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'reset-email-error' : undefined}
          className={inputClass}
          {...register('email')}
        />
        {errors.email?.message ? (
          <p id="reset-email-error" className="mt-1 text-small text-destructive">
            {t(errors.email.message)}
          </p>
        ) : null}
      </div>

      {errors.root?.message ? (
        <p role="alert" className="text-small text-destructive">
          {t(errors.root.message)}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t('auth.password_reset.submit')}
      </Button>

      <p className="text-small text-muted-foreground">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          {t('common.nav.login')}
        </Link>
      </p>
    </form>
  )
}
