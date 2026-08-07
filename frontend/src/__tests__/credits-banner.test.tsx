import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreditsWelcomeBanner } from '@/components/search/CreditsWelcomeBanner'
import { CreditProvider } from '@/components/providers/CreditProvider'
import { creditsService } from '@/lib/api/credits-service'

type SessionShape = {
  isAuthenticated: boolean
  status: 'loading' | 'authenticated' | 'guest'
  user: {
    email: string
    locale: string
    tier: string
    credits_balance: number
    email_verified_at: string | null
  } | null
  refresh: () => void
  logout: () => void
}

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn<() => SessionShape>(() => ({
    isAuthenticated: false,
    status: 'guest',
    user: null,
    refresh: vi.fn(),
    logout: vi.fn(),
  })),
}))

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: useSessionMock,
}))

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, params?: Record<string, string | number>): string => {
      if (params === undefined) return key
      const rendered: Record<string, string> = {}
      for (const [name, value] of Object.entries(params)) {
        rendered[name] = String(value)
      }
      return `${key}(${JSON.stringify(rendered)})`
    },
  useLocale: () => 'en',
}))

vi.mock('@/lib/api/credits-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/credits-service')>()
  return {
    ...actual,
    creditsService: {
      ledger: vi.fn(),
      getBanner: vi.fn(),
      dismissBanner: vi.fn(),
    },
  }
})

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: null,
}

function authenticated(overrides: Partial<typeof USER> = {}): SessionShape {
  return {
    isAuthenticated: true,
    status: 'authenticated',
    user: { ...USER, ...overrides },
    refresh: vi.fn(),
    logout: vi.fn(),
  }
}

function renderBanner() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CreditProvider>
        <CreditsWelcomeBanner />
      </CreditProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(creditsService.getBanner).mockResolvedValue({ dismissed: false })
})

describe('CreditsWelcomeBanner trigger', () => {
  it('renders nothing for guests', () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: false,
      status: 'guest',
      user: null,
      refresh: vi.fn(),
      logout: vi.fn(),
    })
    renderBanner()
    expect(screen.queryByTestId('credits-banner')).not.toBeInTheDocument()
  })

  it('renders nothing for Starter users (free-only welcome, no fetch)', () => {
    useSessionMock.mockReturnValue(authenticated({ tier: 'starter', credits_balance: 15 }))
    renderBanner()
    expect(creditsService.getBanner).not.toHaveBeenCalled()
    expect(screen.queryByTestId('credits-banner')).not.toBeInTheDocument()
  })

  it('renders nothing at zero balance', async () => {
    useSessionMock.mockReturnValue(authenticated({ tier: 'free', credits_balance: 0 }))
    renderBanner()
    await waitFor(() => expect(creditsService.getBanner).toHaveBeenCalled())
    expect(screen.queryByTestId('credits-banner')).not.toBeInTheDocument()
  })

  it('renders nothing while the dismissal state is still loading (no flash)', () => {
    vi.mocked(creditsService.getBanner).mockReturnValue(new Promise(() => {}))
    useSessionMock.mockReturnValue(authenticated({ tier: 'free', credits_balance: 15 }))
    renderBanner()
    expect(screen.queryByTestId('credits-banner')).not.toBeInTheDocument()
  })

  it('renders nothing when the dismissal query fails (no error re-show)', async () => {
    vi.mocked(creditsService.getBanner).mockRejectedValue(new Error('boom'))
    useSessionMock.mockReturnValue(authenticated({ tier: 'free', credits_balance: 15 }))
    renderBanner()
    await waitFor(() => expect(creditsService.getBanner).toHaveBeenCalled())
    expect(screen.queryByTestId('credits-banner')).not.toBeInTheDocument()
  })

  it('renders the info strip for a free user with a positive balance', async () => {
    useSessionMock.mockReturnValue(authenticated({ tier: 'free', credits_balance: 15 }))
    renderBanner()
    const banner = await screen.findByTestId('credits-banner')
    expect(banner.className).toContain('bg-info-container')
    expect(banner.className).toContain('text-info-on-container')
    expect(banner.className).toContain('rounded-md')
    expect(banner.querySelector('svg')).not.toBeNull()
    expect(banner).toHaveTextContent('common.credits.banner_welcome({"count":"15"})')
  })

  it('renders the LIVE balance count (never a stale 15)', async () => {
    useSessionMock.mockReturnValue(authenticated({ tier: 'free', credits_balance: 12 }))
    renderBanner()
    const banner = await screen.findByTestId('credits-banner')
    expect(banner).toHaveTextContent('common.credits.banner_welcome({"count":"12"})')
  })

  it('renders nothing when dismissed', async () => {
    vi.mocked(creditsService.getBanner).mockResolvedValue({ dismissed: true })
    useSessionMock.mockReturnValue(authenticated({ tier: 'free', credits_balance: 15 }))
    renderBanner()
    await waitFor(() =>
      expect(screen.queryByTestId('credits-banner')).not.toBeInTheDocument(),
    )
  })
})

describe('CreditsWelcomeBanner dismissal', () => {
  it('dismisses on X click and unmounts after the invalidation lands', async () => {
    vi.mocked(creditsService.dismissBanner).mockResolvedValue({ dismissed: true })
    // First read: not dismissed (banner shows); after the dismiss invalidation
    // refetches, the banner state flips and the banner unmounts.
    vi.mocked(creditsService.getBanner)
      .mockResolvedValueOnce({ dismissed: false })
      .mockResolvedValue({ dismissed: true })
    useSessionMock.mockReturnValue(authenticated({ tier: 'free', credits_balance: 15 }))
    renderBanner()
    const banner = await screen.findByTestId('credits-banner')
    const dismiss = screen.getByRole('button', { name: 'common.actions.close' })
    fireEvent.click(dismiss)

    await waitFor(() => expect(creditsService.dismissBanner).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByTestId('credits-banner')).not.toBeInTheDocument())
  })

  it('re-fetches the dismissed state through the credits factory invalidation', async () => {
    vi.mocked(creditsService.dismissBanner).mockResolvedValue({ dismissed: true })
    vi.mocked(creditsService.getBanner)
      .mockResolvedValueOnce({ dismissed: false })
      .mockResolvedValue({ dismissed: true })
    useSessionMock.mockReturnValue(authenticated({ tier: 'free', credits_balance: 15 }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <CreditProvider>
          <CreditsWelcomeBanner />
        </CreditProvider>
      </QueryClientProvider>,
    )
    await screen.findByTestId('credits-banner')
    const before = client.getQueryCache().getAll()
    expect(before.some((entry) => entry.queryKey[2] === 'a@b.dz')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'common.actions.close' }))
    await waitFor(() =>
      expect(screen.queryByTestId('credits-banner')).not.toBeInTheDocument(),
    )
  })
})
