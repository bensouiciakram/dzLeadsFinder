import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="fr" dir="ltr">
      <body>{children}</body>
    </html>
  )
}
