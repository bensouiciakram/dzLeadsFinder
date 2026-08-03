import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FrozenAccountPanel } from '@/components/auth/FrozenAccountPanel'
import { SessionProvider } from '@/components/providers/SessionProvider'

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: pushMock, replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const settingsServiceMock = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  frozenStatus: vi.fn(),
  undelete: vi.fn(),
}))

vi.mock('@/lib/api/settings-service', () => ({
  settingsService: settingsServiceMock,
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

const USER = {
  email: 'user@example.com',
  locale: 'ar',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: '2026-07-01T10:00:00+00:00',
}

const RECOVERABLE = {
  deletion_scheduled_at: '2026-08-10T10:00:00+00:00',
  days_left: 7,
}

function renderPanel() {
  return render(
    <SessionProvider>
      <FrozenAccountPanel />
    </SessionProvider>,
  )
}

describe('FrozenAccountPanel', () => {
  beforeEach(() => {
    pushMock.mockClear()
    settingsServiceMock.deleteAccount.mockReset()
    settingsServiceMock.frozenStatus.mockReset()
    settingsServiceMock.undelete.mockReset()
    authServiceMock.login.mockReset()
    authServiceMock.logout.mockReset()
    authServiceMock.me.mockReset()
    authServiceMock.refresh.mockReset()
  })

  it('renders the scheduled date and days-left copy from the status endpoint', async () => {
    settingsServiceMock.frozenStatus.mockResolvedValue(RECOVERABLE)
    renderPanel()
    expect(await screen.findByText('auth.frozen.scheduled_on')).toBeInTheDocument()
    expect(screen.getByText('auth.frozen.days_left')).toBeInTheDocument()
    expect(screen.getByText('auth.frozen.recover')).toBeInTheDocument()
  })

  it('renders an irreversible state without a recover button when the grace period passed', async () => {
    settingsServiceMock.frozenStatus.mockResolvedValue({
      deletion_scheduled_at: '2026-08-01T10:00:00+00:00',
      days_left: 0,
    })
    renderPanel()
    expect(await screen.findByText('auth.frozen.irreversible')).toBeInTheDocument()
    expect(screen.queryByText('auth.frozen.recover')).not.toBeInTheDocument()
  })

  it('recovers the account and redirects to search on success', async () => {
    settingsServiceMock.frozenStatus.mockResolvedValue(RECOVERABLE)
    settingsServiceMock.undelete.mockResolvedValue(undefined)
    authServiceMock.me.mockResolvedValue(USER)
    renderPanel()
    fireEvent.click(await screen.findByText('auth.frozen.recover'))
    await waitFor(() => expect(settingsServiceMock.undelete).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/search'))
  })

  it('shows a recover error when undelete fails and keeps the button usable', async () => {
    settingsServiceMock.frozenStatus.mockResolvedValue(RECOVERABLE)
    settingsServiceMock.undelete.mockRejectedValue(new Error('offline'))
    renderPanel()
    fireEvent.click(await screen.findByText('auth.frozen.recover'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('auth.frozen.recover_error')
    expect(screen.getByText('auth.frozen.recover')).toBeInTheDocument()
  })

  it('shows a status error with a retry button when the status fetch fails', async () => {
    settingsServiceMock.frozenStatus.mockRejectedValueOnce(new Error('offline'))
    settingsServiceMock.frozenStatus.mockResolvedValue(RECOVERABLE)
    renderPanel()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('auth.frozen.status_error')
    fireEvent.click(screen.getByText('auth.frozen.retry'))
    expect(await screen.findByText('auth.frozen.scheduled_on')).toBeInTheDocument()
  })

  it('ignores a second recover click while a request is in flight', async () => {
    settingsServiceMock.frozenStatus.mockResolvedValue(RECOVERABLE)
    let resolveUndelete: (value: undefined) => void
    settingsServiceMock.undelete.mockReturnValue(
      new Promise<undefined>((resolve) => {
        resolveUndelete = resolve
      }),
    )
    renderPanel()
    fireEvent.click(await screen.findByText('auth.frozen.recover'))
    await waitFor(() => expect(settingsServiceMock.undelete).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'auth.frozen.recovering' }))
    expect(settingsServiceMock.undelete).toHaveBeenCalledTimes(1)
    resolveUndelete!(undefined)
  })

  it('keeps the logout control available in every state', async () => {
    settingsServiceMock.frozenStatus.mockResolvedValue(RECOVERABLE)
    renderPanel()
    expect(await screen.findByText('auth.frozen.logout')).toBeInTheDocument()
  })
})
