import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Mail } from 'lucide-react'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trust.about' })

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

export default async function About({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trust.about')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <div className="text-center md:text-start">
        <span className="inline-flex items-center rounded-full bg-warm px-3 py-1 text-caption font-medium text-warm-foreground">
          {t('founder_label')}
        </span>
        <h1 className="mt-3 text-display font-bold">{t('heading')}</h1>
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-warm md:mx-0" />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-16">
        <div className="lg:col-span-4">
          <div className="relative">
            <div className="aspect-[3/4] w-full max-w-xs rounded-lg bg-muted ring-1 ring-border md:max-w-none" role="img" aria-label={t('headshot_alt')} />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
              <span className="rounded-full bg-warm px-3 py-1 text-caption font-medium text-warm-foreground shadow-sm">
                {t('founder_label')} — dzLeadsFinder
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 md:p-8">
            <div className="absolute inset-y-0 start-0 w-1 bg-warm" />
            <div className="relative space-y-5">
              <p className="text-body text-muted-foreground">{t('narrative_line1')}</p>
              <p className="text-body text-muted-foreground">{t('narrative_line2')}</p>
              <p className="text-body text-muted-foreground">{t('narrative_line3')}</p>
              <p className="text-body text-muted-foreground">{t('narrative_line4')}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-6 rounded-lg border border-border bg-muted p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <h2 className="text-title font-semibold">{t('contact_label')}</h2>
              <p className="mt-1 text-small text-muted-foreground">{t('contact_email')}</p>
            </div>
            <a
              href={`mailto:${t('contact_email')}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Mail className="size-4" />
              {t('contact_label')}
            </a>
          </div>

        </div>
      </div>
    </main>
  )
}
