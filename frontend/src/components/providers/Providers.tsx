'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SessionProvider } from './SessionProvider'
import { LocaleProvider } from './LocaleProvider'
import { CreditProvider } from './CreditProvider'
import { ToastProvider } from './ToastProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <LocaleProvider>
          <ToastProvider>
            <CreditProvider>{children}</CreditProvider>
          </ToastProvider>
        </LocaleProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
