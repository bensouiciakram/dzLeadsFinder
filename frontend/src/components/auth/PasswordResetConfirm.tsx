'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { NewPasswordForm } from '@/components/auth/NewPasswordForm'
import { authService } from '@/lib/api/auth-service'

type Props = { token: string }

type ConfirmState =
  | { kind: 'loading' }
  | { kind: 'valid' }
  | { kind: 'done' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'error' }

function LinkProblemView({
  titleKey,
  descriptionKey,
}: {
  titleKey: string
  descriptionKey: string
}) {
  const t = useTranslations()
  return (
    <div>
      <h1 className="text-title font-bold text-foreground">{t(titleKey)}</h1>
      <p className="mt-2 text-small text-muted-foreground">{t(descriptionKey)}</p>
      <Link
        href="/password-reset"
        className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {t('auth.password_reset.request_new_link')}
      </Link>
    </div>
  )
}

export function PasswordResetConfirm({ token }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [state, setState] = useState<ConfirmState>({ kind: 'loading' })

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

  // The outcome guards mirror the original functional setStates: a result
  // that lands after `done` must never demote the success screen.
  const markDone = () => setState({ kind: 'done' })
  const markUsed = () => setState((prev) => (prev.kind === 'done' ? prev : { kind: 'used' }))
  const markError = () => setState((prev) => (prev.kind === 'done' ? prev : { kind: 'error' }))

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
        <NewPasswordForm token={token} onDone={markDone} onUsed={markUsed} onError={markError} />
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
        <LinkProblemView
          titleKey="auth.password_reset.expired_title"
          descriptionKey="auth.password_reset.expired_description"
        />
      ) : null}

      {state.kind === 'used' ? (
        <LinkProblemView
          titleKey="auth.password_reset.used_title"
          descriptionKey="auth.password_reset.used_description"
        />
      ) : null}

      {state.kind === 'error' ? (
        <div>
          <h1 className="text-title font-bold text-foreground">{t('common.states.error')}</h1>
        </div>
      ) : null}
    </div>
  )
}
