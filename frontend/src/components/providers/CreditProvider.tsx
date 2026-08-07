'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { CreditBalances } from '@/lib/api/reveal-service'
import { useSession } from './SessionProvider'

type CreditContextValue = {
  balance: number | null
  applyCreditDelta: (delta: number) => void
  applyConfirmedBalance: (balances: CreditBalances) => void
}

const CreditContext = createContext<CreditContextValue>({
  balance: null,
  applyCreditDelta: () => {},
  applyConfirmedBalance: () => {},
})

export function useCredits() {
  return useContext(CreditContext)
}

export function CreditProvider({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const [balance, setBalance] = useState<number | null>(user?.credits_balance ?? null)

  useEffect(() => {
    setBalance(user?.credits_balance ?? null)
  }, [user])

  const value = useMemo<CreditContextValue>(
    () => ({
      balance,
      applyCreditDelta: (delta: number) => {
        setBalance((current) => (current === null ? null : current + delta))
      },
      applyConfirmedBalance: (balances: CreditBalances) => {
        setBalance((current) => (current === null ? null : balances.display_balance))
      },
    }),
    [balance],
  )

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>
}
