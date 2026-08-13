import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Globe, Database, CheckCircle, AlertCircle, Landmark, Users } from 'lucide-react'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trust.how_we_verify' })

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

function SourceCard({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode
  name: string
  description: string
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-title font-semibold">{name}</h3>
      <p className="mt-2 text-small text-muted-foreground">{description}</p>
    </div>
  )
}

export default async function HowWeVerify({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trust.how_we_verify')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter py-16 md:px-gutter-desktop md:py-24">
      <div className="max-w-2xl text-center md:text-start">
        <h1 className="text-display font-bold">{t('heading')}</h1>
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-warm md:mx-0" />
        <p className="mt-4 text-body text-muted-foreground">{t('description')}</p>
      </div>

      <section className="mt-16">
        <h2 className="text-headline font-semibold">{t('sources_used_title')}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SourceCard
            icon={<Globe className="size-5" />}
            name={t('google_places')}
            description={t('google_places_desc')}
          />
          <SourceCard
            icon={<Database className="size-5" />}
            name={t('el_mouchir')}
            description={t('el_mouchir_desc')}
          />
          <SourceCard
            icon={<Globe className="size-5" />}
            name={t('pages_jaunes')}
            description={t('pages_jaunes_desc')}
          />
          <SourceCard
            icon={<Landmark className="size-5" />}
            name={t('cnrc_name')}
            description={t('cnrc_desc')}
          />
          <SourceCard
            icon={<Users className="size-5" />}
            name={t('linkedin_name')}
            description={t('linkedin_desc')}
          />
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-lg bg-info-container p-4 text-info-on-container">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p className="text-small">{t('rate_limit_note')}</p>
        </div>
      </section>

      <div className="mt-16 flex items-start gap-4 rounded-lg bg-success-container p-6 text-success-on-container">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
          <CheckCircle className="size-5" />
        </div>
        <div>
          <h2 className="text-title font-semibold">{t('updates')}</h2>
        </div>
      </div>
    </main>
  )
}
