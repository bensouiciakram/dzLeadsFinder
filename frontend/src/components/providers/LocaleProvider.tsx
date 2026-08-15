'use client'

import { createContext, type ReactNode } from 'react'

type LocaleContextValue = {
  locale: string
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'fr',
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  return (
    <LocaleContext.Provider value={{ locale: 'fr' }}>
      {children}
    </LocaleContext.Provider>
  )
}
