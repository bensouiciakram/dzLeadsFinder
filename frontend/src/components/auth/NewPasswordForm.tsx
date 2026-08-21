'use client'

import { useTranslations } from 'next-intl'
import { isAxiosError } from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { FormErrorSummary } from '@/components/auth/FormErrorSummary'
import { TextInput } from '@/components/ui/input'
import { authService } from '@/lib/api/auth-service'
import { newPasswordSchema, type NewPasswordValues } from '@/lib/validation/auth'

type NewPasswordFormProps = {
  token: string
  onDone: () => void
  onUsed: () => void
  onError: () => void
}

export function NewPasswordForm({ token, onDone, onUsed, onError }: NewPasswordFormProps) {
  const t = useTranslations()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: NewPasswordValues) {
    if (isSubmitting) return
    try {
      await authService.confirmPasswordReset(token, values.password)
      onDone()
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.status === 410) {
          onUsed()
          return
        }
        if (error.response.status === 400) {
          setError('root', { message: 'common.states.error' })
          return
        }
        onError()
        return
      }
      onError()
    }
  }

  return (
    <div>
      <h1 className="text-title font-bold text-foreground">
        {t('auth.password_reset.new_password_title')}
      </h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="reset-new-password" className="text-small font-medium text-foreground">
            {t('auth.password_reset.new_password_label')}
          </label>
          <TextInput
            id="reset-new-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password
                ? 'reset-new-password-error reset-new-password-requirements'
                : 'reset-new-password-requirements'
            }
            {...register('password')}
          />
          {errors.password?.message ? (
            <p
              id="reset-new-password-error"
              tabIndex={-1}
              className="mt-1 text-small text-destructive"
            >
              {t(errors.password.message)}
            </p>
          ) : null}
          <p id="reset-new-password-requirements" className="mt-1 text-small text-muted-foreground">
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
          <TextInput
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? 'reset-confirm-password-error' : undefined
            }
            {...register('confirmPassword')}
          />
          {errors.confirmPassword?.message ? (
            <p
              id="reset-confirm-password-error"
              tabIndex={-1}
              className="mt-1 text-small text-destructive"
            >
              {t(errors.confirmPassword.message)}
            </p>
          ) : null}
        </div>

        {errors.root?.message ? (
          <p role="alert" className="text-small text-destructive">
            {t(errors.root.message)}
          </p>
        ) : null}

        <FormErrorSummary
          errors={[
            errors.password?.message
              ? { id: 'reset-new-password-error', message: errors.password.message }
              : null,
            errors.confirmPassword?.message
              ? { id: 'reset-confirm-password-error', message: errors.confirmPassword.message }
              : null,
          ].filter((item): item is { id: string; message: string } => item !== null)}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {t('auth.password_reset.submit_new')}
        </Button>
      </form>
    </div>
  )
}
