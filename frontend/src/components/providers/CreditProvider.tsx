'use client'

import { createContext, useContext, type ReactNode } from 'react'

type CreditContextValue = {
  balance: number
}

const CreditContext = createContext<CreditContextValue>({
  balance: 0,
})

export function useCredits() {
  return useContext(CreditContext)
}

export function CreditProvider({ children }: { children: ReactNode }) {
  return (
    <CreditContext.Provider value={{ balance: 0 }}>
      {children}
    </CreditContext.Provider>
  )
}
