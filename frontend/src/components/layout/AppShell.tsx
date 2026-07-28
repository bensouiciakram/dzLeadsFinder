import { SessionProvider } from '@/components/providers/SessionProvider'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { CreditProvider } from '@/components/providers/CreditProvider'
import { Header } from './Header'
import { Footer } from './Footer'
import { ConfirmBanner } from '@/components/locale/ConfirmBanner'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        <CreditProvider>
          <div className="flex min-h-screen flex-col">
            <ConfirmBanner />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </CreditProvider>
      </LocaleProvider>
    </SessionProvider>
  )
}
