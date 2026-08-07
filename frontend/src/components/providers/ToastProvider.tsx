'use client'

import { useTranslations } from 'next-intl'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const TOAST_DURATION_MS = 5000

type ToastItem = {
  id: number
  messageKey: string
}

type ToastContextValue = {
  toast: (messageKey: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timersRef = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (messageKey: string) => {
      const id = nextId.current
      nextId.current += 1
      setToasts((current) => [...current, { id, messageKey }])
      const timer = window.setTimeout(() => dismiss(id), TOAST_DURATION_MS)
      timersRef.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer)
      }
    },
    [],
  )

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        data-testid="toast-region"
        className="fixed bottom-4 start-4 end-4 z-50 flex flex-col items-stretch gap-2 md:start-auto md:end-4 md:w-80"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            data-testid="toast"
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-small text-foreground shadow-lg"
          >
            <span className="min-w-0 flex-1">{t(item.messageKey)}</span>
            <button
              type="button"
              aria-label={t('common.actions.close')}
              onClick={() => dismiss(item.id)}
              className="grid min-h-11 min-w-11 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
