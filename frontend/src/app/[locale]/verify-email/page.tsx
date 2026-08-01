import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { VerifyEmailGate } from '@/components/auth/VerifyEmailGate'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.verify' })

  return {
    title: t('title'),
    description: t('gate_description'),
  }
}

export default async function VerifyEmailPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('common.states')

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-6 md:p-8">
            <p className="text-small text-muted-foreground">{t('loading')}</p>
          </div>
        }
      >
        <VerifyEmailGate />
      </Suspense>
    </main>
  )
}
