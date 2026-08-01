import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { VerifyLinkHandler } from '@/components/auth/VerifyLinkHandler'

type Props = { params: Promise<{ locale: string; token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.verify' })

  return {
    title: t('title'),
    description: t('gate_description'),
  }
}

export default async function VerifyEmailTokenPage({ params }: Props) {
  const { locale, token } = await params
  setRequestLocale(locale)

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <VerifyLinkHandler token={token} />
    </main>
  )
}
