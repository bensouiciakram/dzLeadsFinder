'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { isArabic } from '@/components/search/ResultsTable'
import type {
  CompanyResultRow,
  PeopleResultRow,
  SearchTab,
} from '@/lib/api/search-service'

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

function CompanyLink({ name, companyId }: { name: string | null; companyId: string | null }) {
  if (name === null || companyId === null) return <EmDash />
  return (
    <Link
      href={`/companies/${companyId}`}
      className="text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm focus-visible:outline-none"
    >
      <MaybeArabic text={name} />
    </Link>
  )
}

function RevealSlot() {
  const t = useTranslations()
  return (
    <button
      type="button"
      aria-disabled="true"
      data-testid="reveal-slot"
      className="mt-3 flex w-full min-h-11 items-center justify-center rounded-md text-small text-primary md:min-h-8"
    >
      {t('common.actions.reveal')}
    </button>
  )
}

function WilayaLine({ code, name }: { code: number | null; name: string | null }) {
  return (
    <p className="mt-0.5 text-small text-muted-foreground">
      {code === null || name === null ? (
        <EmDash />
      ) : (
        <span>
          <span className="tabular-nums">{code}</span> — <MaybeArabic text={name} />
        </span>
      )}
    </p>
  )
}

export type ResultsTableStackedRowProps = {
  tab: SearchTab
  rows: PeopleResultRow[] | CompanyResultRow[]
}

export function ResultsTableStackedRow({ tab, rows }: ResultsTableStackedRowProps) {
  const t = useTranslations()
  return (
    <div data-testid="stacked-rows" className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => {
        const people = tab === 'people'
        const person = people ? (row as PeopleResultRow) : null
        const company = people ? null : (row as CompanyResultRow)
        const metaLines = people
          ? [person?.role ?? null]
          : [
              company?.industry ?? null,
              company?.size_band === null
                ? null
                : t(`search.size.${company?.size_band?.replace('-', '_').replace('+', '_plus')}`),
            ]
        return (
          <article
            key={row.id}
            data-testid="stacked-card"
            className="rounded-lg border border-border bg-card p-gutter"
          >
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
            {people && person?.company_name !== null ? (
              <p className="mt-0.5 text-small">
                <CompanyLink name={person?.company_name ?? null} companyId={person?.company_id ?? null} />
              </p>
            ) : null}
            <RevealSlot />
          </article>
        )
      })}
    </div>
  )
}
