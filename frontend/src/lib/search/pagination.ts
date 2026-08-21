import { SEARCH_MAX_NAVIGABLE_PAGES, SEARCH_PAGE_SIZE } from '@/lib/api/search-service'

export function totalPages(total: number): number {
  return Math.min(SEARCH_MAX_NAVIGABLE_PAGES, Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)))
}
