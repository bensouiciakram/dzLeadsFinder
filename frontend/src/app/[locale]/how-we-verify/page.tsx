import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Globe, Database, XCircle, CheckCircle, AlertCircle } from 'lucide-react'

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

export default async function HowWeVerify({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trust.how_we_verify')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <div className="max-w-2xl text-center md:text-start">
        <h1 className="text-display font-bold">{t('heading')}</h1>
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-warm md:mx-0" />
        <p className="mt-4 text-body text-muted-foreground">{t('description')}</p>
      </div>

      <section className="mt-16">
        <h2 className="text-headline font-semibold">{t('sources_used_title')}</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Globe className="size-5" />
            </div>
            <h3 className="mt-4 text-title font-semibold">{t('google_places')}</h3>
            <p className="mt-2 text-small text-muted-foreground">{t('google_places_desc')}</p>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Database className="size-5" />
            </div>
            <h3 className="mt-4 text-title font-semibold">{t('el_mouchir')}</h3>
            <p className="mt-2 text-small text-muted-foreground">{t('el_mouchir_desc')}</p>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Globe className="size-5" />
            </div>
            <h3 className="mt-4 text-title font-semibold">{t('pages_jaunes')}</h3>
            <p className="mt-2 text-small text-muted-foreground">{t('pages_jaunes_desc')}</p>
          </div>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-lg bg-info-container p-4 text-info-on-container">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p className="text-small">{t('rate_limit_note')}</p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-headline font-semibold">{t('sources_not_used_title')}</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-danger" />
            <div className="flex size-10 items-center justify-center rounded-full bg-danger-container text-danger-on-container">
              <XCircle className="size-5" />
            </div>
            <h3 className="mt-4 text-title font-semibold">{t('cnrc_name')}</h3>
            <p className="mt-2 text-small text-muted-foreground">{t('cnrc_rationale')}</p>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-danger" />
            <div className="flex size-10 items-center justify-center rounded-full bg-danger-container text-danger-on-container">
              <XCircle className="size-5" />
            </div>
            <h3 className="mt-4 text-title font-semibold">{t('linkedin_name')}</h3>
            <p className="mt-2 text-small text-muted-foreground">{t('linkedin_rationale')}</p>
          </div>
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
