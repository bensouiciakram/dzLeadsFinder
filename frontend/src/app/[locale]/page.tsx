import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'
import { MapPin, ShieldCheck, User, Search, Eye, FileDown, Check, ArrowRight, Building2, Coins } from 'lucide-react'

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
        <section className="py-16 md:py-24">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
            <div className="flex-1 text-center lg:text-start">
              <span className="inline-flex items-center rounded-full bg-warm px-3 py-1 text-caption font-medium text-warm-foreground">
                {t('trust_title')}
              </span>
              <h1 className="mt-4 text-display font-bold tracking-tight">
                {t('hero_title')}
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-body text-muted-foreground lg:mx-0">
                {t('hero_subtitle')}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
                <Link
                  href="/signup"
                  className={buttonVariants({ size: 'lg' })}
                >
                  {t('hero_cta')}
                  <ArrowRight className="ms-2 size-4" />
                </Link>
                <span className="text-small text-muted-foreground">{t('hero_note')}</span>
              </div>
            </div>

            <div className="grid w-full max-w-md grid-cols-2 gap-4 lg:max-w-lg">
              <div className="rounded-lg border border-border bg-card p-5 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MapPin className="size-5" />
                </div>
                <p className="mt-3 text-title font-semibold">{t('stats.wilayas')}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Building2 className="size-5" />
                </div>
                <p className="mt-3 text-title font-semibold">{t('stats.industries')}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </div>
                <p className="mt-3 text-title font-semibold">{t('stats.sources')}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Coins className="size-5" />
                </div>
                <p className="mt-3 text-title font-semibold">{t('stats.credits')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border">
          <div className="flex flex-col md:flex-row">
            <div className="flex flex-1 items-center gap-3 border-b border-border py-5 md:border-b-0 md:border-e md:border-border md:px-6">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </div>
              <p className="text-small font-semibold">{t('trust_badge_wilayas')}</p>
            </div>
            <div className="flex flex-1 items-center gap-3 border-b border-border py-5 md:border-b-0 md:border-e md:border-border md:px-6">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <p className="text-small font-semibold">{t('trust_badge_sources')}</p>
            </div>
            <div className="flex flex-1 items-center gap-3 py-5 md:px-6">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-4" />
              </div>
              <p className="text-small font-semibold">{t('trust_badge_founder')}</p>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="text-center">
            <p className="text-caption font-medium uppercase tracking-wide text-warm">
              {t('how_it_works_title')}
            </p>
            <h2 className="mt-3 text-headline font-semibold">{t('how_it_works_title')}</h2>
          </div>
          <div className="relative mt-12 grid gap-8 md:grid-cols-3">
            <div className="absolute top-[1.25rem] hidden h-px bg-border md:block start-[16.67%] end-[16.67%]" />
            <div className="relative">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Search className="size-4" />
              </div>
              <div className="mt-4">
                <p className="text-caption font-semibold uppercase text-primary">{t('step1_label')}</p>
                <p className="mt-2 text-body text-muted-foreground">{t('step1')}</p>
              </div>
            </div>
            <div className="relative">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Eye className="size-4" />
              </div>
              <div className="mt-4">
                <p className="text-caption font-semibold uppercase text-primary">{t('step2_label')}</p>
                <p className="mt-2 text-body text-muted-foreground">{t('step2')}</p>
              </div>
            </div>
            <div className="relative">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <FileDown className="size-4" />
              </div>
              <div className="mt-4">
                <p className="text-caption font-semibold uppercase text-primary">{t('step3_label')}</p>
                <p className="mt-2 text-body text-muted-foreground">{t('step3')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="text-center">
            <p className="text-caption font-medium uppercase tracking-wide text-warm">
              {t('pricing_title')}
            </p>
            <h2 className="mt-3 text-headline font-semibold">{t('pricing_title')}</h2>
            <p className="mx-auto mt-4 max-w-xl text-body text-muted-foreground">
              {t('starter_desc')}
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
            <p className="text-center text-title font-semibold">{t('starter_name')}</p>
            <p className="mt-2 text-center text-display font-bold">{t('starter_price')}</p>
            <p className="mt-1 text-center text-small text-muted-foreground">{t('starter_desc')}</p>
            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3 text-small text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {t('starter_feature_1')}
              </li>
              <li className="flex items-start gap-3 text-small text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {t('starter_feature_2')}
              </li>
              <li className="flex items-start gap-3 text-small text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {t('starter_feature_3')}
              </li>
            </ul>
            <div className="mt-8 text-center">
              <Link
                href="/signup"
                className={buttonVariants({ className: 'w-full' })}
              >
                {t('hero_cta')}
              </Link>
              <p className="mt-3 text-caption text-success">{t('free_trial')}</p>
            </div>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="relative overflow-hidden rounded-lg border border-border bg-muted p-8 md:p-12">
            <div className="absolute inset-y-0 start-0 w-1 bg-warm" />
            <div className="relative">
              <p className="text-caption font-semibold uppercase tracking-wide text-warm">
                {t('founder_note_teaser')}
              </p>
              <blockquote className="mt-4 max-w-2xl text-headline font-semibold leading-snug">
                &ldquo;{t('founder_note_text')}&rdquo;
              </blockquote>
              <Link
                href="/about"
                className="mt-6 inline-flex items-center text-small font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('founder_note_link')}
                <ArrowRight className="ms-1 size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
