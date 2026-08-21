'use client'

import { useTranslations } from 'next-intl'

import type { CompanyContact, PeopleContact } from '@/lib/api/reveal-service'
import { bandLabelKey } from '@/components/search/results-format'

const SAFE_URL = /^https?:\/\//i

function Field({ labelKey, children }: { labelKey: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{labelKey}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function PeopleFields({ contact }: { contact: PeopleContact }) {
  const t = useTranslations()
  return (
    <dl className="grid gap-2 text-small" data-testid="reveal-fields">
      <Field labelKey={t('search.reveal.field_email')}>{contact.email ?? '—'}</Field>
      <Field labelKey={t('search.reveal.field_phone')}>
        <span className="tabular-nums">{contact.phone ?? '—'}</span>
      </Field>
      <Field labelKey={t('search.reveal.field_address')}>{contact.address ?? '—'}</Field>
    </dl>
  )
}

function CompanyFields({ contact }: { contact: CompanyContact }) {
  const t = useTranslations()
  const bandKey = contact.size_band === null ? null : bandLabelKey(contact.size_band)
  return (
    <dl className="grid gap-2 text-small" data-testid="reveal-fields">
      {contact.website !== null && (
        <Field labelKey={t('search.reveal.field_website')}>
          {SAFE_URL.test(contact.website) ? (
            <a
              href={contact.website}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {contact.website}
            </a>
          ) : (
            <span className="break-all">{contact.website}</span>
          )}
        </Field>
      )}
      {contact.industry !== null && (
        <Field labelKey={t('search.reveal.field_industry')}>{contact.industry}</Field>
      )}
      {contact.size_band !== null && (
        <Field labelKey={t('search.reveal.field_size_band')}>
          {bandKey === null ? contact.size_band : t(bandKey)}
        </Field>
      )}
    </dl>
  )
}

export function RevealContactFields({
  contact,
}: {
  contact: PeopleContact | CompanyContact
}) {
  if (contact.record_type === 'people') {
    return <PeopleFields contact={contact} />
  }
  return <CompanyFields contact={contact} />
}
