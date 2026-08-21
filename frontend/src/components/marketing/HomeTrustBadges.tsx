import { MapPin, ShieldCheck, User } from 'lucide-react'

type HomeSectionProps = { t: (key: string) => string }

export function HomeTrustBadges({ t }: HomeSectionProps) {
  return (
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
  )
}
