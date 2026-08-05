import type { Metadata } from 'next'
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

export default async function SearchPageRoute({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <SearchPage tab="people" />
}
