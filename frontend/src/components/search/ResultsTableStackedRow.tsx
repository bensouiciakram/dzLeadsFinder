'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import {
  bandLabelKey,
  CompanyLink,
  EmDash,
  MaybeArabic,
  WilayaLine,
} from '@/components/search/results-format'
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

function Card({
  tab,
  row,
}: {
  tab: SearchTab
  row: PeopleResultRow | CompanyResultRow
}) {
  const t = useTranslations()
  const state = useRevealState({ tab, row })
  const people = tab === 'people'
  const person = people ? (row as PeopleResultRow) : null
  const company = people ? null : (row as CompanyResultRow)
  const metaLines = people
    ? [person?.role ?? null]
    : [
        company?.industry ?? null,
        company?.size_band === null
          ? null
          : bandLabelKey(company?.size_band ?? '') === null
            ? company?.size_band ?? null
            : t(bandLabelKey(company?.size_band ?? '') as string),
      ]

  return (
    <article data-testid="stacked-card" className="rounded-lg border border-border bg-card p-gutter">
      {people ? (
        <p className="text-title text-foreground">
          <MaybeArabic text={person?.name ?? ''} />
        </p>
      ) : (
        <p className="text-title text-foreground">
          <CompanyLink name={company?.name ?? null} companyId={company?.id ?? null} />
        </p>
      )}
      {metaLines.map((line, index) => (
        <p key={index} className="mt-0.5 text-small text-muted-foreground">
          {line === null ? <EmDash /> : <MaybeArabic text={line} />}
        </p>
      ))}
      <WilayaLine code={row.wilaya_code} name={row.wilaya_name} />
      {people && (
        <p className="mt-0.5 text-small">
          {person?.company_name === null ? (
            <EmDash />
          ) : (
            <CompanyLink
              name={person?.company_name ?? null}
              companyId={person?.company_id ?? null}
            />
          )}
        </p>
      )}
      {!people && (
        <p className="mt-0.5 text-small text-muted-foreground">
          {t('search.results.columns.people_count')}:{' '}
          <span className="tabular-nums">{String(company?.people_count ?? 0)}</span>
        </p>
      )}
      <RevealControl tab={tab} row={row} />
      <RevealContent state={state} />
    </article>
  )
}

type ResultsTableStackedRowProps = {
  tab: SearchTab
  rows: PeopleResultRow[] | CompanyResultRow[]
}

export function ResultsTableStackedRow({ tab, rows }: ResultsTableStackedRowProps) {
  return (
    <div data-testid="stacked-rows" className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <Card key={row.id} tab={tab} row={row} />
      ))}
    </div>
  )
}
