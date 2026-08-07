import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CreditsPage } from '@/components/credits/CreditsPage'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common.credits' })

  return {
    title: t('ledger'),
  }
}

export default async function CreditsRoute({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <CreditsPage />
}
