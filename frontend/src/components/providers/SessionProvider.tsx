'use client'

import { createContext, useContext, type ReactNode } from 'react'

type SessionContextValue = {
  isAuthenticated: boolean
}

const SessionContext = createContext<SessionContextValue>({
  isAuthenticated: false,
})

export function useSession() {
  return useContext(SessionContext)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionContext.Provider value={{ isAuthenticated: false }}>
      {children}
    </SessionContext.Provider>
  )
}
