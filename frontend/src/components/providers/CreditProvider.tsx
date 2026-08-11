'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { CreditBalances } from '@/lib/api/reveal-service'
import { useSession } from './SessionProvider'

type CreditContextValue = {
  balance: number | null
  applyCreditDelta: (delta: number) => void
  applyConfirmedBalance: (balances: CreditBalances) => void
  // 5.6 (Sally's 5.3 pill-trap handoff): the status-card success flow bumps
  // the baseline nonce so the CreditsPill treats the grant-announced balance
  // update as mount-like — no false DECREASE announcement (e.g. a renewal's
  // pool math 250 → 200). The pill resets its prevBalanceRef when the nonce
  // changes.
  baselineNonce: number
  resetBaseline: () => void
}

const CreditContext = createContext<CreditContextValue>({
  balance: null,
  applyCreditDelta: () => {},
  applyConfirmedBalance: () => {},
  baselineNonce: 0,
  resetBaseline: () => {},
})

export function useCredits() {
  return useContext(CreditContext)
}

export function CreditProvider({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const [balance, setBalance] = useState<number | null>(user?.credits_balance ?? null)
  const [baselineNonce, setBaselineNonce] = useState(0)

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
      baselineNonce,
      resetBaseline: () => {
        setBaselineNonce((current) => current + 1)
      },
    }),
    [balance, baselineNonce],
  )

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>
}
