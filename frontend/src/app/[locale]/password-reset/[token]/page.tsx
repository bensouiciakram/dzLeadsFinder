import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { PasswordResetConfirm } from '@/components/auth/PasswordResetConfirm'

type Props = { params: Promise<{ locale: string; token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.password_reset' })

  return {
    title: t('new_password_title'),
    description: t('description'),
  }
}

export default async function PasswordResetConfirmPage({ params }: Props) {
  const { locale, token } = await params
  setRequestLocale(locale)

  return (
    <main className="mx-auto max-w-content-max-marketing px-gutter px-gutter-desktop py-16 md:py-24">
      <PasswordResetConfirm token={token} />
    </main>
  )
}
