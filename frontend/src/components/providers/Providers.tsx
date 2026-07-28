'use client'

import { SessionProvider } from './SessionProvider'
import { LocaleProvider } from './LocaleProvider'
import { CreditProvider } from './CreditProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        <CreditProvider>
          {children}
        </CreditProvider>
      </LocaleProvider>
    </SessionProvider>
  )
}
