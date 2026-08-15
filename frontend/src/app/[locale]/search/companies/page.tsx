import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SearchPage } from '@/components/search/SearchPage'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'search' })

  return {
    title: t('title'),
  }
}

export default async function SearchCompaniesPageRoute({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Suspense>
      <SearchPage tab="companies" />
    </Suspense>
  )
}
