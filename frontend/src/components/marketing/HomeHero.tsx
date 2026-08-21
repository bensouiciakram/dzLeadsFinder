import { ArrowRight, Building2, Coins, MapPin, ShieldCheck } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'

type HomeSectionProps = { t: (key: string) => string }

export function HomeHero({ t }: HomeSectionProps) {
  return (
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
  )
}
