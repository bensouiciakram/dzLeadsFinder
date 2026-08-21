'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSavedSearchMutations } from '@/hooks/useSavedSearchMutations'
import type { SavedSearchRow } from '@/lib/api/saved-search-service'

type SavedSearchDeleteDialogProps = {
  row: SavedSearchRow | null
  onClose: () => void
}

export function SavedSearchDeleteDialog({ row, onClose }: SavedSearchDeleteDialogProps) {
  const t = useTranslations()
  const { remove } = useSavedSearchMutations()
  const [deleteError, setDeleteError] = useState(false)

  const handleDelete = async () => {
    if (row === null) return
    setDeleteError(false)
    try {
      await remove.mutateAsync(row.id)
      onClose()
    } catch {
      setDeleteError(true)
    }
  }

  return (
    <Dialog open={row !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('search.saved.delete_confirm')}</DialogTitle>
          <DialogDescription>{row?.name}</DialogDescription>
        </DialogHeader>
        {deleteError && (
          <p role="alert" className="text-small text-destructive">
            {t('common.states.error')}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={remove.isPending}>
            {remove.isPending ? t('common.states.loading') : t('common.actions.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
