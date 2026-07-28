'use client'

import { createContext, useContext, type ReactNode } from 'react'

type LocaleContextValue = {
  locale: string
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'fr',
})

export function useLocaleContext() {
  return useContext(LocaleContext)
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  return (
    <LocaleContext.Provider value={{ locale: 'fr' }}>
      {children}
    </LocaleContext.Provider>
  )
}
