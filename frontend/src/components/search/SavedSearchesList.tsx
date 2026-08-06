'use client'

import { MoreVerticalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { SavedSearchNameDialog } from '@/components/search/SavedSearchNameDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/components/providers/SessionProvider'
import { useSavedSearchMutations } from '@/hooks/useSavedSearchMutations'
import { useSavedSearches } from '@/hooks/useSavedSearches'
import {
  tabToSavedType,
  type SavedSearchPayload,
  type SavedSearchRow,
  type SavedSearchSort,
  type SavedSearchType,
} from '@/lib/api/saved-search-service'
import type { SearchTab } from '@/lib/api/search-service'

export type SavedSearchSnapshot = {
  type: SavedSearchType
  filters: Record<string, unknown>
  sort: SavedSearchSort | null
}

export type SavedSearchesListProps = {
  tab: SearchTab
  activeSearchId: string | null
  activeSearch: SavedSearchSnapshot | null
  onRerun: (row: SavedSearchRow) => void
}

const CAPS: Record<string, number> = { free: 5, starter: 25 }

export function SavedSearchesList({
  tab,
  activeSearchId,
  activeSearch,
  onRerun,
}: SavedSearchesListProps) {
  const t = useTranslations()
  const { user } = useSession()
  const { savedSearches, phase, refetch } = useSavedSearches({ user })
  const { create, rename, remove } = useSavedSearchMutations()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameRow, setRenameRow] = useState<SavedSearchRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<SavedSearchRow | null>(null)

  const tier = user?.tier ?? 'free'
  const cap = CAPS[tier] ?? CAPS.free
  const atCap = savedSearches.length >= cap
  const savedType = tabToSavedType(tab)
  const rows = savedSearches.filter((row) => row.type === savedType)

  const handleCreate = async (name: string) => {
    if (activeSearch === null) return
    const payload: SavedSearchPayload = { name, ...activeSearch }
    await create.mutateAsync(payload)
  }

  const handleRename = async (name: string) => {
    if (renameRow === null) return
    await rename.mutateAsync({ id: renameRow.id, name })
  }

  const handleDelete = async () => {
    if (deleteRow === null) return
    await remove.mutateAsync(deleteRow.id)
    setDeleteRow(null)
  }

  const saveButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={activeSearch === null}
      aria-disabled={atCap || undefined}
      onClick={() => setCreateOpen(true)}
      className="min-h-11 md:min-h-8"
    >
      {t('search.saved.save')}
    </Button>
  )

  return (
    <section data-testid="saved-searches" className="border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-caption text-muted-foreground">{t('search.saved.title')}</h3>
        {atCap && activeSearch !== null ? (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{saveButton}</TooltipTrigger>
            <TooltipContent>
              {t(
                tier === 'starter'
                  ? 'search.saved.cap_tooltip_starter'
                  : 'search.saved.cap_tooltip_free',
                { limit: String(cap) },
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          saveButton
        )}
      </div>

      {phase === 'loading' && (
        <p className="mt-3 text-small text-muted-foreground">{t('common.states.loading')}</p>
      )}

      {phase === 'error' && (
        <div className="mt-3">
          <p className="text-small text-destructive">{t('common.states.error')}</p>
          <Button variant="outline" size="sm" className="mt-2 min-h-11 md:min-h-8" onClick={refetch}>
            {t('search.results.retry')}
          </Button>
        </div>
      )}

      {phase === 'success' && rows.length === 0 && (
        <p className="mt-3 text-small text-muted-foreground">{t('search.saved.empty')}</p>
      )}

      {phase === 'success' && rows.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {rows.map((row) => {
            const isActive = row.id === activeSearchId
            return (
              <li
                key={row.id}
                aria-current={isActive ? 'true' : undefined}
                className={
                  isActive
                    ? 'flex items-center gap-1 rounded-md bg-muted'
                    : 'flex items-center gap-1 rounded-md'
                }
              >
                <button
                  type="button"
                  onClick={() => onRerun(row)}
                  className="min-h-11 grow truncate rounded-md px-3 text-start text-small text-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
                >
                  {row.name}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t('search.saved.actions')}
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-8 md:min-w-8"
                  >
                    <MoreVerticalIcon className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setRenameRow(row)}>
                      <PencilIcon />
                      {t('search.saved.rename')}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteRow(row)}>
                      <Trash2Icon />
                      {t('common.actions.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      )}

      <SavedSearchNameDialog
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <SavedSearchNameDialog
        open={renameRow !== null}
        mode="rename"
        initialName={renameRow?.name}
        onClose={() => setRenameRow(null)}
        onSubmit={handleRename}
      />

      <Dialog open={deleteRow !== null} onOpenChange={(next) => !next && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('search.saved.delete_confirm')}</DialogTitle>
            <DialogDescription>{deleteRow?.name}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              {t('common.actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
