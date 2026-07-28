import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { Space_Grotesk } from 'next/font/google'
import { getDir } from '@/i18n/routing'
import { AppShell } from '@/components/layout/AppShell'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

export const metadata: Metadata = {
  title: 'dzLeadsFinder',
  description: 'Algerian B2B Lead Generation Platform',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const dir = getDir(locale)
  const messages = await getMessages()

  return (
    <html lang={locale} dir={dir} className={spaceGrotesk.variable}>
      <body>
          <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
