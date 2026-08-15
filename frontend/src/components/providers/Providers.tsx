'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SessionProvider } from './SessionProvider'
import { CreditProvider } from './CreditProvider'
import { ToastProvider } from './ToastProvider'
import { UpgradeDialogProvider } from './UpgradeDialogProvider'
import { RecoveryDialogProvider } from './RecoveryDialogProvider'

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
        <ToastProvider>
          <UpgradeDialogProvider>
            <RecoveryDialogProvider>
              <CreditProvider>{children}</CreditProvider>
            </RecoveryDialogProvider>
          </UpgradeDialogProvider>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
