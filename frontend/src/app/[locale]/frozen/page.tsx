import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { FrozenLogout } from '@/components/auth/FrozenLogout'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.frozen' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function FrozenPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth.frozen')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
        <h1 className="text-title font-bold text-foreground">{t('title')}</h1>
        <p className="mt-2 text-small text-muted-foreground">{t('description')}</p>
        <p className="mt-4 text-small text-foreground">{t('grace_note')}</p>
        <p className="mt-2 text-small text-muted-foreground">{t('support_note')}</p>
        <div className="mt-6">
          <FrozenLogout />
        </div>
      </div>
    </main>
  )
}
