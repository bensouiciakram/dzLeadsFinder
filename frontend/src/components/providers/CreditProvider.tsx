'use client'

import {
  createContext,
  useContext,
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

  // M12: the old useEffect synced the server balance AFTER render — every
  // session change rendered once with a stale balance, then re-rendered
  // after the effect (a flash + an extra pass). The React-endorsed
  // "adjusting state during render" pattern (stored previous user) applies
  // the reset on the SAME render as the session change — the balance and
  // the user never disagree in a committed frame. Semantics are unchanged:
  // a user change re-bases on the server value (any in-flight local delta
  // is superseded, exactly like the effect did).
  const [prevUser, setPrevUser] = useState(user)
  if (user !== prevUser) {
    setPrevUser(user)
    setBalance(user?.credits_balance ?? null)
  }

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
