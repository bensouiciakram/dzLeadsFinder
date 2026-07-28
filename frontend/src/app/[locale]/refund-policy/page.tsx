import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Ban, FileWarning, CircleDollarSign } from 'lucide-react'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trust.refund' })

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

export default async function RefundPolicy({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trust.refund')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <div className="max-w-2xl text-center md:text-start">
        <h1 className="text-display font-bold">{t('heading')}</h1>
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-warm md:mx-0" />
      </div>

      <section className="relative mt-10 overflow-hidden rounded-lg border border-border bg-card p-6 pt-7 md:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-danger" />
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-container text-danger-on-container">
            <Ban className="size-5" />
          </div>
          <div>
            <h2 className="text-title font-semibold">{t('default_stance')}</h2>
          </div>
        </div>
      </section>

      <section className="relative mt-6 overflow-hidden rounded-lg border border-border bg-card p-6 pt-7 md:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-warning" />
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-container text-warning-on-container">
            <FileWarning className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-title font-semibold">{t('exception_title')}</h2>
            <p className="mt-2 text-body text-muted-foreground">{t('exception_desc')}</p>
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-muted p-4">
              <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-small text-muted-foreground">{t('exception_scope')}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
