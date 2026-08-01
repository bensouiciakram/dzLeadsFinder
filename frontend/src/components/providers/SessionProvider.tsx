'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'

import { authService, type SessionUser } from '@/lib/api/auth-service'

type SessionStatus = 'loading' | 'authenticated' | 'guest'

type SessionContextValue = {
  isAuthenticated: boolean
  status: SessionStatus
  user: SessionUser | null
  refresh: () => Promise<boolean>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue>({
  isAuthenticated: false,
  status: 'loading',
  user: null,
  refresh: async () => false,
  logout: async () => {},
})

export function useSession() {
  return useContext(SessionContext)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const inflight = useRef<Promise<boolean> | null>(null)

  const probe = useCallback(async (): Promise<boolean> => {
    if (inflight.current) return inflight.current
    const attempt = (async () => {
      try {
        const me = await authService.me()
        setUser(me)
        setStatus('authenticated')
        return true
      } catch {
        setUser(null)
        setStatus('guest')
        return false
      }
    })()
    inflight.current = attempt
    try {
      return await attempt
    } finally {
      inflight.current = null
    }
  }, [])

  useEffect(() => {
    void probe()
  }, [probe])

  const refresh = useCallback(async (): Promise<boolean> => {
    return probe()
  }, [probe])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch {
      // server logout is idempotent — the cookie may already be gone
    }
    setUser(null)
    setStatus('guest')
    router.push('/')
  }, [router])

  return (
    <SessionContext.Provider
      value={{
        isAuthenticated: status === 'authenticated',
        status,
        user,
        refresh,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
