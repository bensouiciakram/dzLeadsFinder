import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'

import { CreditProvider, useCredits } from '@/components/providers/CreditProvider'
import type { CreditBalances } from '@/lib/api/reveal-service'

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: null,
}

const sessionMock = vi.hoisted(() => ({
  user: null as (typeof USER) | null,
}))

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({ user: sessionMock.user }),
}))

const BALANCES: CreditBalances = {
  subscription_balance: 2,
  pack_balance: 0,
  display_balance: 2,
}

function Wrapper({ children }: { children: ReactNode }) {
  return <CreditProvider>{children}</CreditProvider>
}

beforeEach(() => {
  sessionMock.user = null
})

describe('CreditProvider', () => {
  it('seeds the balance from the session user credits_balance', () => {
    sessionMock.user = USER
    const { result } = renderHook(() => useCredits(), { wrapper: Wrapper })
    expect(result.current.balance).toBe(15)
  })

  it('reports null for guests', () => {
    sessionMock.user = null
    const { result } = renderHook(() => useCredits(), { wrapper: Wrapper })
    expect(result.current.balance).toBeNull()
  })

  it('re-seeds the balance when the session user changes', () => {
    sessionMock.user = USER
    const { result, rerender } = renderHook(() => useCredits(), { wrapper: Wrapper })
    act(() => result.current.applyCreditDelta(-1))
    expect(result.current.balance).toBe(14)

    sessionMock.user = { ...USER, credits_balance: 5 }
    rerender()
    expect(result.current.balance).toBe(5)
  })

  it('applies an optimistic credit delta', () => {
    sessionMock.user = USER
    const { result } = renderHook(() => useCredits(), { wrapper: Wrapper })
    act(() => result.current.applyCreditDelta(-1))
    expect(result.current.balance).toBe(14)
  })

  it('rolls the balance back with a positive delta', () => {
    sessionMock.user = USER
    const { result } = renderHook(() => useCredits(), { wrapper: Wrapper })
    act(() => result.current.applyCreditDelta(-1))
    act(() => result.current.applyCreditDelta(1))
    expect(result.current.balance).toBe(15)
  })

  it('overwrites the balance with the confirmed server value', () => {
    sessionMock.user = USER
    const { result } = renderHook(() => useCredits(), { wrapper: Wrapper })
    act(() => result.current.applyCreditDelta(-1))
    act(() => result.current.applyConfirmedBalance(BALANCES))
    expect(result.current.balance).toBe(2)
  })

  it('is a no-op for guests on deltas and confirmed balances', () => {
    sessionMock.user = null
    const { result } = renderHook(() => useCredits(), { wrapper: Wrapper })
    act(() => result.current.applyCreditDelta(-1))
    expect(result.current.balance).toBeNull()
    act(() => result.current.applyConfirmedBalance(BALANCES))
    expect(result.current.balance).toBeNull()
  })
})
