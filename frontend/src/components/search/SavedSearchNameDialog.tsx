'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isSavedSearchLimitError } from '@/lib/api/saved-search-service'
import { savedSearchNameSchema, type SavedSearchNameForm } from '@/lib/validation/saved-search'

type SavedSearchNameDialogProps = {
  open: boolean
  mode: 'create' | 'rename'
  initialName?: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function SavedSearchNameDialog({
  open,
  mode,
  initialName,
  onClose,
  onSubmit,
}: SavedSearchNameDialogProps) {
  const t = useTranslations()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SavedSearchNameForm>({
    resolver: zodResolver(savedSearchNameSchema),
    defaultValues: { name: '' },
  })

  useEffect(() => {
    if (open) reset({ name: initialName ?? '' })
  }, [open, initialName, reset])

  const submit = async (values: SavedSearchNameForm) => {
    try {
      await onSubmit(values.name)
      onClose()
    } catch (error) {
      setError('root', {
        message: isSavedSearchLimitError(error)
          ? 'search.saved.max_capacity'
          : 'common.states.error',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('search.saved.save') : t('search.saved.rename_title')}
          </DialogTitle>
          <DialogDescription>{t('search.saved.name_placeholder')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate>
          <label htmlFor="saved-search-name" className="text-small font-medium text-foreground">
            {t('search.saved.name_label')}
          </label>
          <input
            id="saved-search-name"
            type="text"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'saved-search-name-error' : undefined}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30"
            placeholder={t('search.saved.name_placeholder')}
            {...register('name')}
          />
          {errors.name?.message ? (
            <p id="saved-search-name-error" className="mt-1 text-small text-destructive">
              {t(errors.name.message)}
            </p>
          ) : null}
          {errors.root?.message ? (
            <p role="alert" className="mt-1 text-small text-destructive">
              {t(errors.root.message)}
            </p>
          ) : null}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.states.loading') : t('common.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
