import { fireEvent, render, screen } from '@testing-library/react'
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
    const logo = screen.getByRole('img', { name: 'dzLeadsFinder' })
    expect(logo).toBeInTheDocument()
    expect(screen.getByText('dzLeadsFinder')).toBeInTheDocument()
    expect(logo.closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('dzLeadsFinder').closest('a')).toHaveAttribute('href', '/')
  })

  it('renders login and signup links for guests', () => {
    renderHeader()
    expect(screen.getByText('login')).toBeInTheDocument()
    expect(screen.getByText('start_free')).toBeInTheDocument()
  })

  it('renders LocaleSwitcher', () => {
    renderHeader()
    expect(screen.getByLabelText('Switch language')).toBeInTheDocument()
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
