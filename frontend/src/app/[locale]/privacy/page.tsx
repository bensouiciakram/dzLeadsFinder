import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shield, Scale, AlertTriangle, Mail, MapPin } from 'lucide-react'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trust.privacy' })

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

export default async function Privacy({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trust.privacy')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <div className="max-w-2xl text-center md:text-start">
        <h1 className="text-display font-bold">{t('heading')}</h1>
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-warm md:mx-0" />
      </div>

      <section className="mt-10 rounded-lg border border-border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Scale className="size-5" />
          </div>
          <div>
            <h2 className="text-title font-semibold">{t('law_reference')}</h2>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Shield className="size-5" />
          </div>
          <h2 className="text-headline font-semibold">{t('data_subject_title')}</h2>
        </div>
        <p className="mt-4 text-body text-muted-foreground">{t('data_subject_intro')}</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          <li className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-small text-muted-foreground">{t('right_access')}</span>
          </li>
          <li className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-small text-muted-foreground">{t('right_rectification')}</span>
          </li>
          <li className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-small text-muted-foreground">{t('right_deletion')}</span>
          </li>
          <li className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-small text-muted-foreground">{t('right_portability')}</span>
          </li>
        </ul>
        <p className="mt-6 text-body text-muted-foreground">{t('response_time')}</p>
      </section>

      <section className="mt-10 rounded-lg border border-border bg-card p-6 md:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Shield className="size-5" />
          </div>
          <h2 className="text-headline font-semibold">{t('deletion_title')}</h2>
        </div>
        <p className="mt-4 text-body text-muted-foreground">{t('deletion_intro')}</p>
        <p className="mt-3 text-small text-muted-foreground">{t('deletion_process')}</p>
        <p className="mt-3 text-small text-muted-foreground">{t('deletion_ledger')}</p>
      </section>

      <section className="mt-10 flex items-start gap-4 rounded-lg bg-warning-container p-6 text-warning-on-container">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
        <p className="text-small">{t('anpdp_note')}</p>
      </section>

      <section className="mt-10 rounded-lg border border-border bg-card p-6 md:p-8">
        <h2 className="text-title font-semibold">{t('takedown_contact')}</h2>
        <div className="mt-4 space-y-3">
          <a
            href={`mailto:${t('takedown_email')}`}
            className="flex items-center gap-2 text-body text-primary underline-offset-4 hover:underline"
          >
            <Mail className="size-4" />
            {t('takedown_email')}
          </a>
          <p className="flex items-center gap-2 text-small text-muted-foreground">
            <MapPin className="size-4" />
            {t('mailing_address')}
          </p>
        </div>
      </section>
    </main>
  )
}
