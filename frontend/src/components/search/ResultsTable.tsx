'use client'

import { Fragment } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RevealContent,
  RevealControl,
  useRevealState,
} from '@/components/search/RevealControl'
import type {
  CompanyResultRow,
  PeopleResultRow,
  SearchTab,
} from '@/lib/api/search-service'
import { cn } from '@/lib/utils'

export type SortField =
  | 'name'
  | 'role'
  | 'company_name'
  | 'wilaya_code'
  | 'industry'
  | 'size_band'
  | 'people_count'

export type SortState = {
  field: SortField
  dir: 'asc' | 'desc' | null
}

type Column = {
  field: SortField | null
  headerKey: string
  widthClass?: string
}

const PEOPLE_COLUMNS: Column[] = [
  { field: 'name', headerKey: 'search.sort.name', widthClass: 'w-[20%]' },
  { field: 'role', headerKey: 'search.results.columns.role', widthClass: 'w-[15%]' },
  { field: 'company_name', headerKey: 'search.results.columns.company', widthClass: 'w-[22%]' },
  { field: 'wilaya_code', headerKey: 'search.sort.wilaya', widthClass: 'w-[13%]' },
  { field: null, headerKey: 'common.actions.reveal', widthClass: 'w-[30%]' },
]

const COMPANY_COLUMNS: Column[] = [
  { field: 'name', headerKey: 'search.sort.name', widthClass: 'w-[25%]' },
  { field: 'industry', headerKey: 'search.filters.industry', widthClass: 'w-[25%]' },
  { field: 'wilaya_code', headerKey: 'search.sort.wilaya', widthClass: 'w-[20%]' },
  { field: 'size_band', headerKey: 'search.filters.size', widthClass: 'w-[15%]' },
  { field: 'people_count', headerKey: 'search.results.columns.people_count', widthClass: 'w-[15%]' },
]

export function sortCycle(field: SortField, current: SortState | null): SortState {
  if (current === null || current.field !== field) {
    return { field, dir: 'asc' }
  }
  if (current.dir === null) return { field, dir: 'asc' }
  if (current.dir === 'asc') return { field, dir: 'desc' }
  return { field, dir: null }
}

const KNOWN_BANDS = ['1-10', '11-50', '51-200', '201-500', '500+']

export function bandLabelKey(band: string): string | null {
  if (!KNOWN_BANDS.includes(band)) return null
  return `search.size.${band.replace('-', '_').replace('+', '_plus')}`
}

export function columnLabelKey(field: SortField): string {
  switch (field) {
    case 'name':
      return 'search.sort.name'
    case 'role':
      return 'search.results.columns.role'
    case 'company_name':
      return 'search.results.columns.company'
    case 'wilaya_code':
      return 'search.sort.wilaya'
    case 'industry':
      return 'search.filters.industry'
    case 'size_band':
      return 'search.filters.size'
    case 'people_count':
      return 'search.results.columns.people_count'
  }
}

export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text) && !/[\u0041-\u024F]/.test(text)
}

function MaybeArabic({ text }: { text: string }) {
  if (!isArabic(text)) return <>{text}</>
  return (
    <span lang="ar" dir="rtl">
      {text}
    </span>
  )
}

function EmDash() {
  return <span className="text-muted-foreground">—</span>
}

function WilayaCell({ code, name }: { code: number | null; name: string | null }) {
  if (code === null || name === null) return <EmDash />
  return (
    <span>
      <span className="tabular-nums">{code}</span> — <MaybeArabic text={name} />
    </span>
  )
}

function CompanyLink({ name, companyId }: { name: string | null; companyId: string | null }) {
  if (!name || companyId === null) return <EmDash />
  return (
    <Link
      href={`/companies/${companyId}`}
      className="text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm focus-visible:outline-none"
    >
      <MaybeArabic text={name} />
    </Link>
  )
}

function RevealSlot({ tab, row }: { tab: SearchTab; row: PeopleResultRow | CompanyResultRow }) {
  return <RevealControl tab={tab} row={row} />
}

function PeopleExpansionRow({ row }: { row: PeopleResultRow }) {
  const state = useRevealState({ tab: 'people', row })
  if (!state.showRegion) return null
  return (
    <TableRow className="hover:bg-muted">
      <TableCell colSpan={PEOPLE_COLUMNS.length} className="whitespace-normal px-2 py-3 align-top">
        <RevealContent state={state} />
      </TableCell>
    </TableRow>
  )
}

function PeopleCells({ row }: { row: PeopleResultRow }) {
  const t = useTranslations()
  return (
    <>
      <TableCell className="whitespace-normal break-words font-medium text-foreground">
        <MaybeArabic text={row.name} />
      </TableCell>
      <TableCell className="whitespace-normal break-words">
        {row.role === null ? <EmDash /> : <MaybeArabic text={row.role} />}
      </TableCell>
      <TableCell className="whitespace-normal break-words">
        <CompanyLink name={row.company_name} companyId={row.company_id} />
      </TableCell>
      <TableCell className="whitespace-normal break-words">
        <WilayaCell code={row.wilaya_code} name={row.wilaya_name} />
      </TableCell>
      <TableCell>
        <RevealSlot tab="people" row={row} />
      </TableCell>
    </>
  )
}

function CompanyCells({ row }: { row: CompanyResultRow }) {
  const t = useTranslations()
  return (
    <>
      <TableCell className="whitespace-normal break-words font-medium text-foreground">
        <CompanyLink name={row.name} companyId={row.id} />
      </TableCell>
      <TableCell className="whitespace-normal break-words">
        {row.industry === null ? <EmDash /> : <MaybeArabic text={row.industry} />}
      </TableCell>
      <TableCell className="whitespace-normal break-words">
        <WilayaCell code={row.wilaya_code} name={row.wilaya_name} />
      </TableCell>
      <TableCell className="whitespace-normal break-words">
        {row.size_band === null ? (
          <EmDash />
        ) : (
          <span>
            {bandLabelKey(row.size_band) === null
              ? row.size_band
              : t(bandLabelKey(row.size_band) as string)}
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-normal tabular-nums">{String(row.people_count)}</TableCell>
    </>
  )
}

type ResultsTableProps = {
  tab: SearchTab
  rows: PeopleResultRow[] | CompanyResultRow[]
  sort: SortState | null
  onSortChange: (sort: SortState) => void
  skeleton?: boolean
}

const SKELETON_ROWS = 5

export function ResultsTable({ tab, rows, sort, onSortChange, skeleton = false }: ResultsTableProps) {
  const t = useTranslations()
  const columns = tab === 'people' ? PEOPLE_COLUMNS : COMPANY_COLUMNS
  const activeDir = (field: SortField): 'asc' | 'desc' | null =>
    sort !== null && sort.field === field ? sort.dir : null

  return (
    <div data-testid="results-table" className="hidden md:block">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="h-12">
            {columns.map((column) => {
              const dir = column.field === null ? null : activeDir(column.field)
              const ariaSort = dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined
              return (
                <TableHead
                  key={column.headerKey}
                  aria-sort={ariaSort}
                  className={cn(
                    'h-8 whitespace-normal px-2 text-start font-semibold text-muted-foreground',
                    column.widthClass,
                  )}
                >
                  {column.field === null ? (
                    <span data-slot="sort-label" className="text-small">
                      {t(column.headerKey)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSortChange(sortCycle(column.field as SortField, sort))}
                      className="inline-flex min-h-11 items-center gap-1 font-semibold rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-8"
                    >
                      <span data-slot="sort-label" className="text-small">
                        {t(column.headerKey)}
                      </span>
                      <span
                        data-testid={`sort-chevron-${column.field}`}
                        data-state={dir === null ? 'none' : dir}
                        className={dir === null ? 'text-muted-foreground' : undefined}
                      >
                        {dir === 'asc' ? (
                          <ChevronUp className="size-4" />
                        ) : dir === 'desc' ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronsUpDown className="size-4" />
                        )}
                      </span>
                    </button>
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-b">
          {skeleton
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <TableRow
                  key={`skeleton-${index}`}
                  data-testid="skeleton-row"
                  aria-hidden="true"
                  className="h-12 hover:bg-muted"
                >
                  {columns.map((column) => (
                    <TableCell key={column.headerKey} className="px-2">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow className="h-12 hover:bg-muted">
                    {tab === 'people' ? (
                      <PeopleCells row={row as PeopleResultRow} />
                    ) : (
                      <CompanyCells row={row as CompanyResultRow} />
                    )}
                  </TableRow>
                  {tab === 'people' && <PeopleExpansionRow row={row as PeopleResultRow} />}
                </Fragment>
              ))}
        </TableBody>
      </Table>
    </div>
  )
}
