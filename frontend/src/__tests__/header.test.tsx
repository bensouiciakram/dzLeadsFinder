import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { UpgradeDialogProvider } from '@/components/providers/UpgradeDialogProvider'
import { RecoveryDialogProvider } from '@/components/providers/RecoveryDialogProvider'
import type { SessionUser } from '@/lib/api/auth-service'

type SessionState = {
  isAuthenticated: boolean
  status: string
  user: SessionUser | null
  logout: () => void
}

const { useSessionMock, logoutMock } = vi.hoisted(() => {
  const logoutMock = vi.fn()
  const session: SessionState = {
    isAuthenticated: false,
    status: 'guest',
    user: null,
    logout: logoutMock,
  }
  return {
    useSessionMock: vi.fn(() => session),
    logoutMock,
  }
})

const planMock = vi.hoisted(() => vi.fn(() => Promise.resolve({
  tier: 'free', status: null, renews_on: null,
  balances: { subscription_balance: 0, pack_balance: 0, display_balance: 15 },
})))
vi.mock('@/lib/api/billing-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/billing-service')>()
  return { ...actual, billingService: { ...actual.billingService, plan: planMock } }
})

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: useSessionMock,
}))

// The Header now hosts data islands (the 5.7 SubscriptionChip reads the
// plan query + the Upgrade Dialog trigger; the CreditsPill dispatches the
// 0-credit recovery by tier) — the tests must provide the QueryClient +
// the dialog providers.
function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UpgradeDialogProvider>
        <RecoveryDialogProvider>
          <Header />
        </RecoveryDialogProvider>
      </UpgradeDialogProvider>
    </QueryClientProvider>,
  )
}

describe('Header (guest)', () => {
  beforeEach(() => {
    logoutMock.mockClear()
    useSessionMock.mockReturnValue({
      isAuthenticated: false,
      status: 'guest',
      user: null,
      logout: logoutMock,
    })
  })

  it('renders logo linking to homepage', () => {
    renderHeader()
    const logo = screen.getByRole('img', { name: 'DzLeadsFinder' })
    expect(logo).toBeInTheDocument()
    expect(screen.getByText('DzLeadsFinder')).toBeInTheDocument()
    expect(logo.closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('DzLeadsFinder').closest('a')).toHaveAttribute('href', '/')
  })

  it('renders login and signup links for guests', () => {
    renderHeader()
    expect(screen.getByText('login')).toBeInTheDocument()
    expect(screen.getByText('start_free')).toBeInTheDocument()
  })

  it('renders LocaleSwitcher in the desktop nav and the mobile island', () => {
    renderHeader()
    const switches = screen.getAllByLabelText('Switch language')
    expect(switches).toHaveLength(2)
    expect(switches[0].closest('nav')).not.toBeNull()
    expect(switches[1].closest('nav')).toBeNull()
  })
})

describe('Header (authenticated)', () => {
  beforeEach(() => {
    logoutMock.mockClear()
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: {
        email: 'a@b.dz',
        locale: 'en',
        tier: 'starter',
        credits_balance: 100,
        email_verified_at: '2026-08-01T12:00:00+01:00',
      },
      logout: logoutMock,
    })
  })

  it('calls logout when the logout button is clicked', () => {
    renderHeader()
    fireEvent.click(screen.getByText('logout'))
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it('disables the logout button while a logout is pending', () => {
    renderHeader()
    const button = screen.getByText('logout')
    fireEvent.click(button)
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })
})

describe('Header mobile menu', () => {
  beforeEach(() => {
    logoutMock.mockClear()
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: {
        email: 'a@b.dz',
        locale: 'en',
        tier: 'starter',
        credits_balance: 100,
        email_verified_at: '2026-08-01T12:00:00+01:00',
      },
      logout: logoutMock,
    })
  })

  it('opens the navigation drawer with the authenticated links', async () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'menu_open' }))

    const dialog = await screen.findByRole('dialog', { name: 'menu' })
    expect(within(dialog).getByRole('link', { name: 'search' })).toHaveAttribute('href', '/search')
    expect(within(dialog).getByRole('link', { name: 'billing' })).toHaveAttribute('href', '/billing')
    expect(within(dialog).getByRole('link', { name: 'settings' })).toHaveAttribute('href', '/settings')
    expect(within(dialog).getByRole('button', { name: 'logout' })).toBeInTheDocument()
  })

  it('calls logout from the drawer', async () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'menu_open' }))
    const dialog = await screen.findByRole('dialog', { name: 'menu' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'logout' }))

    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it('closes the drawer via its close button', async () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'menu_open' }))
    await screen.findByRole('dialog', { name: 'menu' })
    fireEvent.click(screen.getByRole('button', { name: 'menu_close' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows login and signup links for guests in the drawer', async () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: false,
      status: 'guest',
      user: null,
      logout: logoutMock,
    })
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'menu_open' }))

    const dialog = await screen.findByRole('dialog', { name: 'menu' })
    expect(within(dialog).getByRole('link', { name: 'login' })).toHaveAttribute('href', '/login')
    expect(within(dialog).getByRole('link', { name: 'start_free' })).toHaveAttribute('href', '/signup')
  })
})
