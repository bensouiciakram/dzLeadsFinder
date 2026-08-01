'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = { email?: string; password?: string; form?: string }

export function SignupForm() {
  const t = useTranslations('auth.signup')
  const common = useTranslations('common')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const trimmed = email.trim()
    if (!trimmed) {
      next.email = common('errors.required')
    } else if (!EMAIL_PATTERN.test(trimmed)) {
      next.email = common('errors.invalid_email')
    }
    if (!password) {
      next.password = common('errors.required')
    } else if ([...password].length < 8) {
      next.password = common('errors.invalid_password')
    }
    return next
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const fieldErrors = validate()
    setErrors(fieldErrors)
    if (fieldErrors.email || fieldErrors.password) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (response.ok) {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`)
        return
      }
      if (response.status === 400) {
        let data: { email?: string[]; password?: string[]; code?: { email?: string[] } } = {}
        try {
          data = (await response.json()) as typeof data
        } catch {
          setErrors({ form: t('error_generic') })
          return
        }
        const next: FieldErrors = {}
        if (data.email && data.email.length > 0) {
          next.email =
            data.code?.email?.[0] === 'email_taken'
              ? t('error_email_taken')
              : common('errors.invalid_email')
        }
        if (data.password && data.password.length > 0) {
          next.password = t('error_weak_password')
        }
        if (next.email || next.password) {
          setErrors(next)
          return
        }
        setErrors({ form: t('error_generic') })
        return
      }
      setErrors({ form: t('error_generic') })
    } catch {
      setErrors({ form: common('errors.network') })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30'

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="signup-email" className="text-small font-medium text-foreground">
          {t('email_label')}
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'signup-email-error' : undefined}
          className={inputClass}
        />
        {errors.email ? (
          <p id="signup-email-error" className="mt-1 text-small text-destructive">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="signup-password" className="text-small font-medium text-foreground">
          {t('password_label')}
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'signup-password-error' : undefined}
          className={inputClass}
        />
        {errors.password ? (
          <p id="signup-password-error" className="mt-1 text-small text-destructive">
            {errors.password}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p role="alert" className="text-small text-destructive">
          {errors.form}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-small text-muted-foreground">{t('no_card_required')}</span>
        <Button type="submit" disabled={submitting} className="px-5">
          {t('submit')}
        </Button>
      </div>

      <p className="text-small text-muted-foreground">
        {t('has_account')}{' '}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          {t('login_link')}
        </Link>
      </p>
    </form>
  )
}
