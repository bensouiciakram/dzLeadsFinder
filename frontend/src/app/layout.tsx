import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { Inter, Noto_Kufi_Arabic } from 'next/font/google'
import { getDir } from '@/i18n/routing'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-kufi-arabic',
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
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${notoKufiArabic.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
