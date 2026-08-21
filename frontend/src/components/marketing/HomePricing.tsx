import { Check } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { buttonVariants } from '@/components/ui/button'

type HomeSectionProps = { t: (key: string) => string }

export function HomePricing({ t }: HomeSectionProps) {
  return (
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
  )
}
