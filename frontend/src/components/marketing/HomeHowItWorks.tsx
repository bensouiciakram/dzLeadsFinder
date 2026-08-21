import { Eye, FileDown, Search } from 'lucide-react'

type HomeSectionProps = { t: (key: string) => string }

export function HomeHowItWorks({ t }: HomeSectionProps) {
  return (
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
  )
}
