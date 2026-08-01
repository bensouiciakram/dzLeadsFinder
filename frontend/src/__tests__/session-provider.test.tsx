import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionProvider, useSession } from '@/components/providers/SessionProvider'
import type { SessionUser } from '@/lib/api/auth-service'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: pushMock, replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const authServiceMock = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/lib/api/auth-service', () => ({
  authService: authServiceMock,
}))

const USER: SessionUser = {
  email: 'user@example.com',
  locale: 'ar',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: '2026-07-01T10:00:00+00:00',
}

function Probe() {
  const { status, user, refresh, logout } = useSession()
  return (
    <div>
      <span data-testid="status">{status}</span>
      {user ? <span data-testid="email">{user.email}</span> : null}
      <button onClick={() => void refresh()}>refresh</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  )
}

describe('SessionProvider', () => {
  beforeEach(() => {
    pushMock.mockClear()
    authServiceMock.me.mockReset()
    authServiceMock.logout.mockReset()
    authServiceMock.login.mockReset()
    authServiceMock.refresh.mockReset()
  })

  it('starts in loading state and becomes authenticated when the probe succeeds', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    renderProvider()
    expect(screen.getByTestId('status').textContent).toBe('loading')
    expect(await screen.findByTestId('email')).toHaveTextContent('user@example.com')
    expect(screen.getByTestId('status').textContent).toBe('authenticated')
  })

  it('becomes guest when the probe returns a 401 for an unauthenticated visitor', async () => {
    authServiceMock.me.mockRejectedValue(new Error('401'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'))
  })

  it('becomes guest on a network failure without looping', async () => {
    authServiceMock.me.mockRejectedValue(new Error('offline'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'))
    expect(authServiceMock.me).toHaveBeenCalledTimes(1)
  })

  it('logout posts to the endpoint, clears state and redirects home', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    authServiceMock.logout.mockResolvedValue(undefined)
    renderProvider()
    await screen.findByTestId('email')
    fireEvent.click(screen.getByText('logout'))
    await waitFor(() => expect(authServiceMock.logout).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'))
    expect(pushMock).toHaveBeenCalledWith('/')
  })

  it('logout redirects home even when the endpoint fails', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    authServiceMock.logout.mockRejectedValue(new Error('offline'))
    renderProvider()
    await screen.findByTestId('email')
    fireEvent.click(screen.getByText('logout'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'))
    expect(pushMock).toHaveBeenCalledWith('/')
  })

  it('refresh re-probes the session endpoint', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    renderProvider()
    await screen.findByTestId('email')
    authServiceMock.me.mockRejectedValue(new Error('401'))
    fireEvent.click(screen.getByText('refresh'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'))
    expect(authServiceMock.me).toHaveBeenCalledTimes(2)
  })
})
