import { Providers } from '@/components/providers/Providers'
import { Header } from './Header'
import { Footer } from './Footer'
import { ConfirmBanner } from '@/components/locale/ConfirmBanner'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen flex-col">
        <ConfirmBanner />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </Providers>
  )
}
