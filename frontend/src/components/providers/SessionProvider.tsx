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
import { isAxiosError } from 'axios'
import { useRouter } from 'next/navigation'

import { applyAuthRedirect, redirectTargetForError } from '@/lib/api/http-client'
import { authService, type SessionUser } from '@/lib/api/auth-service'

type SessionStatus = 'loading' | 'authenticated' | 'guest'

type RefreshResult = 'authenticated' | 'guest' | 'error'

type SessionContextValue = {
  isAuthenticated: boolean
  status: SessionStatus
  user: SessionUser | null
  refresh: () => Promise<RefreshResult>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue>({
  isAuthenticated: false,
  status: 'loading',
  user: null,
  refresh: async () => 'guest',
  logout: async () => {},
})

export function useSession() {
  return useContext(SessionContext)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const generation = useRef(0)
  const inflight = useRef<Promise<RefreshResult> | null>(null)

  const runProbe = useCallback(async (): Promise<RefreshResult> => {
    const gen = generation.current
    try {
      const me = await authService.me()
      if (gen === generation.current) {
        setUser(me)
        setStatus('authenticated')
      }
      return 'authenticated'
    } catch (error) {
      const redirectFired = applyAuthRedirect(redirectTargetForError(error))
      if (gen === generation.current && !redirectFired) {
        setUser(null)
        setStatus('guest')
      }
      if (isAxiosError(error) && error.response?.status === 401) return 'guest'
      return 'error'
    }
  }, [])

  const probe = useCallback(async (): Promise<RefreshResult> => {
    if (inflight.current) return inflight.current
    const attempt = runProbe()
    inflight.current = attempt
    try {
      return await attempt
    } finally {
      inflight.current = null
    }
  }, [runProbe])

  useEffect(() => {
    void probe()
  }, [probe])

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    generation.current += 1
    return runProbe()
  }, [runProbe])

  const logout = useCallback(async () => {
    generation.current += 1
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
