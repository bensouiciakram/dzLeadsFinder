import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, act, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'

import { ToastProvider, useToast } from '@/components/providers/ToastProvider'

function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ToastProvider', () => {
  it('renders the message inside a polite status live region', () => {
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper })
    act(() => result.current.toast('search.reveal.failed'))

    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('search.reveal.failed')
  })

  it('stacks multiple toasts in order', () => {
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper })
    act(() => result.current.toast('a'))
    act(() => result.current.toast('b'))

    const toasts = screen.getAllByRole('status')
    expect(toasts).toHaveLength(2)
    expect(toasts[0]).toHaveTextContent('a')
    expect(toasts[1]).toHaveTextContent('b')
  })

  it('auto-dismisses after the display duration', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper })
    act(() => result.current.toast('search.reveal.failed'))
    expect(screen.getAllByRole('status')).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })

  it('dismisses manually via the close button', () => {
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper })
    act(() => result.current.toast('search.reveal.failed'))

    const toast = screen.getByRole('status')
    const closeButton = within(toast).getByRole('button')
    act(() => closeButton.click())

    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })
})
