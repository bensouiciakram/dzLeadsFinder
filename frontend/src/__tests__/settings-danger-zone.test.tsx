import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DangerZone } from '@/components/settings/DangerZone'
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

const SCHEDULED = { deletion_scheduled_at: '2026-08-10T10:00:00+00:00' }

const CONSEQUENCES = [
  'settings.dzone.consequence_frozen',
  'settings.dzone.consequence_permanent',
  'settings.dzone.consequence_credits',
  'settings.dzone.consequence_ledger',
]

function renderDangerZone() {
  return render(
    <SessionProvider>
      <DangerZone />
    </SessionProvider>,
  )
}

function unauthorizedResponse() {
  return {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    data: { code: 'not_authenticated' },
    config: { headers: {} },
  } as AxiosResponse
}

describe('DangerZone', () => {
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

  it('renders the danger zone for an authenticated user', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    renderDangerZone()
    expect(await screen.findByText('settings.dzone.title')).toBeInTheDocument()
    expect(screen.getByText('settings.dzone.delete_button')).toBeInTheDocument()
  })

  it('shows a sign-in prompt without a delete button for guests', async () => {
    authServiceMock.me.mockRejectedValue(
      new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, unauthorizedResponse()),
    )
    renderDangerZone()
    expect(await screen.findByText('settings.guest_title')).toBeInTheDocument()
    expect(screen.getByText('settings.guest_cta')).toHaveAttribute('href', '/login')
    expect(screen.queryByText('settings.dzone.delete_button')).not.toBeInTheDocument()
  })

  it('shows all four consequences in the first dialog step', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    renderDangerZone()
    fireEvent.click(await screen.findByText('settings.dzone.delete_button'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    for (const key of CONSEQUENCES) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
    expect(screen.getByText('common.actions.continue')).toBeInTheDocument()
  })

  it('advances to the final confirmation step with Cancel and the destructive confirm', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    renderDangerZone()
    fireEvent.click(await screen.findByText('settings.dzone.delete_button'))
    fireEvent.click(await screen.findByText('common.actions.continue'))
    expect(screen.getByText('settings.dzone.confirm')).toBeInTheDocument()
    const cancel = screen.getByText('common.actions.cancel')
    expect(cancel).toBeInTheDocument()
  })

  it('lands initial focus on the safe Cancel control in the final step', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    renderDangerZone()
    fireEvent.click(await screen.findByText('settings.dzone.delete_button'))
    fireEvent.click(await screen.findByText('common.actions.continue'))
    await waitFor(() => expect(screen.getByText('common.actions.cancel')).toHaveFocus())
  })

  it('cancels the dialog and returns focus to the delete trigger', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    renderDangerZone()
    const trigger = await screen.findByText('settings.dzone.delete_button')
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByText('common.actions.continue'))
    fireEvent.click(screen.getByText('common.actions.cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('deletes the account, shows the confirmation with the scheduled date, and logs out', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    settingsServiceMock.deleteAccount.mockResolvedValue(SCHEDULED)
    authServiceMock.logout.mockResolvedValue(undefined)
    renderDangerZone()
    fireEvent.click(await screen.findByText('settings.dzone.delete_button'))
    fireEvent.click(await screen.findByText('common.actions.continue'))
    fireEvent.click(screen.getByText('settings.dzone.confirm'))
    await waitFor(() => expect(settingsServiceMock.deleteAccount).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('settings.dzone.confirmed_title')).toBeInTheDocument()
    expect(screen.getByText('settings.dzone.confirmed_body')).toBeInTheDocument()
    fireEvent.click(screen.getByText('settings.dzone.confirmed_logout'))
    await waitFor(() => expect(authServiceMock.logout).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })

  it('announces the confirmation state politely', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    settingsServiceMock.deleteAccount.mockResolvedValue(SCHEDULED)
    renderDangerZone()
    fireEvent.click(await screen.findByText('settings.dzone.delete_button'))
    fireEvent.click(await screen.findByText('common.actions.continue'))
    fireEvent.click(screen.getByText('settings.dzone.confirm'))
    const region = (await screen.findByText('settings.dzone.confirmed_title')).closest(
      '[aria-live="polite"]',
    )
    expect(region).not.toBeNull()
  })

  it('shows an error and keeps the dialog open when deletion fails', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    settingsServiceMock.deleteAccount.mockRejectedValue(new Error('offline'))
    renderDangerZone()
    fireEvent.click(await screen.findByText('settings.dzone.delete_button'))
    fireEvent.click(await screen.findByText('common.actions.continue'))
    fireEvent.click(screen.getByText('settings.dzone.confirm'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('settings.dzone.confirm_error')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('settings.dzone.confirm')).toBeInTheDocument()
  })

  it('ignores a second confirm click while the delete request is in flight', async () => {
    authServiceMock.me.mockResolvedValue(USER)
    let resolveDelete: (value: { deletion_scheduled_at: string }) => void
    settingsServiceMock.deleteAccount.mockReturnValue(
      new Promise<{ deletion_scheduled_at: string }>((resolve) => {
        resolveDelete = resolve
      }),
    )
    renderDangerZone()
    fireEvent.click(await screen.findByText('settings.dzone.delete_button'))
    fireEvent.click(await screen.findByText('common.actions.continue'))
    const confirm = screen.getByText('settings.dzone.confirm')
    fireEvent.click(confirm)
    await waitFor(() => expect(settingsServiceMock.deleteAccount).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'settings.dzone.confirming' }))
    expect(settingsServiceMock.deleteAccount).toHaveBeenCalledTimes(1)
    resolveDelete!(SCHEDULED)
  })
})
