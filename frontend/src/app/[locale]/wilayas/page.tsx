import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { WILAYAS } from '@/data/wilayas'
import WilayaTable from '@/components/wilayas/WilayaTable'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trust.wilayas' })

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

export default async function Wilayas({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trust.wilayas')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <h1 className="text-display font-bold">{t('heading')}</h1>
      <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-warm md:mx-0" />
      <p className="mt-4 text-body text-muted-foreground">{t('description')}</p>

      <div className="mt-10">
        <WilayaTable
          wilayas={WILAYAS}
          filterLabel={t('filter_label')}
          filterPlaceholder={t('filter_placeholder')}
          noResults={t('no_results')}
          columnCode={t('column_code')}
          columnArabic={t('column_arabic')}
          columnFrench={t('column_french')}
          columnEnglish={t('column_english')}
          tableCaption={t('table_caption')}
        />
      </div>
    </main>
  )
}
