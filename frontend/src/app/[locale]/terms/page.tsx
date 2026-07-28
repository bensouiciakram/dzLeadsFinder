import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { RefreshCw, Package, Ban, FileText } from 'lucide-react'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trust.terms' })

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

export default async function Terms({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trust.terms')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <div className="max-w-2xl text-center md:text-start">
        <h1 className="text-display font-bold">{t('heading')}</h1>
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-warm md:mx-0" />
      </div>

      <div className="mt-10 space-y-6">
        <section className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7 md:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <RefreshCw className="size-5" />
            </div>
            <div>
              <h2 className="text-title font-semibold">{t('subscription_title')}</h2>
              <p className="mt-2 text-body text-muted-foreground">{t('subscription_desc')}</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7 md:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Package className="size-5" />
            </div>
            <div>
              <h2 className="text-title font-semibold">{t('addon_title')}</h2>
              <p className="mt-2 text-body text-muted-foreground">{t('addon_desc')}</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7 md:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-danger" />
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-container text-danger-on-container">
              <Ban className="size-5" />
            </div>
            <div>
              <h2 className="text-title font-semibold">{t('norefund_title')}</h2>
              <p className="mt-2 text-body text-muted-foreground">{t('norefund_desc')}</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pt-7 md:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-title font-semibold">{t('usage_title')}</h2>
              <p className="mt-2 text-body text-muted-foreground">{t('usage_desc')}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
