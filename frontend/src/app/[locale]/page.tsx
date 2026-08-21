import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { HomeFounderNote } from '@/components/marketing/HomeFounderNote'
import { HomeHero } from '@/components/marketing/HomeHero'
import { HomeHowItWorks } from '@/components/marketing/HomeHowItWorks'
import { HomePricing } from '@/components/marketing/HomePricing'
import { HomeTrustBadges } from '@/components/marketing/HomeTrustBadges'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trust.homepage' })

  return {
    title: t('meta_title'),
    description: t('meta_description'),
    openGraph: {
      title: t('meta_title'),
      description: t('meta_description'),
      locale,
    },
  }
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trust.homepage')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'DzLeadsFinder',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '1500',
              priceCurrency: 'DZD',
              description: t('starter_desc'),
            },
            description: t('hero_subtitle'),
          }),
        }}
      />
      <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop">
        <HomeHero t={t} />
        <HomeTrustBadges t={t} />
        <HomeHowItWorks t={t} />
        <HomePricing t={t} />
        <HomeFounderNote t={t} />
      </main>
    </>
  )
}
