import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SignupForm } from '@/components/auth/SignupForm'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.signup' })

  return {
    title: t('title'),
    description: t('subtitle'),
  }
}

export default async function SignupPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth.signup')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
        <h1 className="text-title font-bold text-foreground">{t('title')}</h1>
        <p className="mt-2 text-small text-muted-foreground">{t('subtitle')}</p>
        <div className="mt-6">
          <SignupForm />
        </div>
      </div>
    </main>
  )
}
