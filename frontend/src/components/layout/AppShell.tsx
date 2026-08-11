import { Providers } from '@/components/providers/Providers'
import { Header } from './Header'
import { Footer } from './Footer'
import { ConfirmBanner } from '@/components/locale/ConfirmBanner'
import { FailedRenewalBanner } from '@/components/layout/FailedRenewalBanner'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen flex-col">
        <ConfirmBanner />
        <Header />
        {/* 5.7 (Sally M3): the persistent failed-renewal banner mounts on
            ALL authenticated surfaces — in-flow below the header, above
            main (it pushes content down; the sticky header stays z-50).
            The component self-gates: renders only when plan.status ===
            'failed_renewal', nothing for guests. */}
        <FailedRenewalBanner />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </Providers>
  )
}
