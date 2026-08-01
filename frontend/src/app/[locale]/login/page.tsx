import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { LoginForm } from '@/components/auth/LoginForm'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.login' })

  return {
    title: t('title'),
    description: t('subtitle'),
  }
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth.login')
  const states = await getTranslations('common.states')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
            <p className="text-small text-muted-foreground">{states('loading')}</p>
          </div>
        }
      >
        <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
          <h1 className="text-title font-bold text-foreground">{t('title')}</h1>
          <p className="mt-2 text-small text-muted-foreground">{t('subtitle')}</p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </Suspense>
    </main>
  )
}
