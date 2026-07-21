import type { Metadata } from 'next'
import { Inter, Noto_Kufi_Arabic } from 'next/font/google'
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fr"
      dir="ltr"
      className={`${inter.variable} ${notoKufiArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
