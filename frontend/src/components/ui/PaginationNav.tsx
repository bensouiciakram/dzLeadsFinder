'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'

type PaginationNavProps = {
  page: number
  pageCount: number
  onPage: (page: number) => void
  // The parent owns the i18n namespace — search and credits label the
  // "page x of y" span with different keys but identical shapes.
  formatLabel: (current: number, total: number) => string
  ariaLabel: string
}

export function PaginationNav({
  page,
  pageCount,
  onPage,
  formatLabel,
  ariaLabel,
}: PaginationNavProps) {
  const t = useTranslations()
  return (
    <nav aria-label={ariaLabel} className="mt-4 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="min-h-11 md:h-8"
      >
        <ChevronLeftIcon className="size-4 rtl:rotate-180" />
        {t('search.results.previous')}
      </Button>
      <span aria-current="page" className="text-small text-muted-foreground tabular-nums">
        {formatLabel(page, pageCount)}
      </span>
      <Button
        variant="outline"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className="min-h-11 md:h-8"
      >
        {t('common.actions.next')}
        <ChevronRightIcon className="size-4 rtl:rotate-180" />
      </Button>
    </nav>
  )
}
