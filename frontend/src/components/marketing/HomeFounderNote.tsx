import { ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'

type HomeSectionProps = { t: (key: string) => string }

export function HomeFounderNote({ t }: HomeSectionProps) {
  return (
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
  )
}
