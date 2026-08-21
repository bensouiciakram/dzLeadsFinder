'use client'

import { SlidersHorizontalIcon } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import type { SearchTab } from '@/lib/api/search-service'

type SearchTabNavProps = {
  tab: SearchTab
  sidebarOpen: boolean
  onReopenSidebar: () => void
}

export function SearchTabNav({ tab, sidebarOpen, onReopenSidebar }: SearchTabNavProps) {
  const t = useTranslations()
  return (
    <nav aria-label={t('common.nav.search')} className="flex gap-2">
      <Link
        href="/search"
        aria-current={tab === 'people' ? 'page' : undefined}
        className={
          tab === 'people'
            ? 'inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-small font-medium text-primary-foreground md:min-h-8'
            : 'inline-flex min-h-11 items-center rounded-md px-4 text-small font-medium text-muted-foreground hover:text-foreground md:min-h-8'
        }
      >
        {t('search.people_tab')}
      </Link>
      <Link
        href="/search/companies"
        aria-current={tab === 'companies' ? 'page' : undefined}
        className={
          tab === 'companies'
            ? 'inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-small font-medium text-primary-foreground md:min-h-8'
            : 'inline-flex min-h-11 items-center rounded-md px-4 text-small font-medium text-muted-foreground hover:text-foreground md:min-h-8'
        }
      >
        {t('search.companies_tab')}
      </Link>
      {!sidebarOpen && (
        <button
          type="button"
          onClick={onReopenSidebar}
          className="hidden min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-small font-medium text-foreground hover:bg-muted md:inline-flex"
        >
          <SlidersHorizontalIcon className="size-4" />
          {t('search.filters.title')}
        </button>
      )}
    </nav>
  )
}
