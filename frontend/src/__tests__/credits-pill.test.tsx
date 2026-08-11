import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { CreditsPill } from '@/components/layout/CreditsPill'
import { CreditProvider, useCredits } from '@/components/providers/CreditProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

type SessionShape = {
  isAuthenticated: boolean
  status: string
  user: { email: string; locale: string; tier: string; credits_balance: number } | null
}

const { useSessionMock } = vi.hoisted(() => {
  return {
    useSessionMock: vi.fn<() => SessionShape>(() => ({
      isAuthenticated: false,
      status: 'guest',
      user: null,
    })),
  }
})

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: useSessionMock,
}))

function BalanceProbe() {
  const { balance, applyCreditDelta } = useCredits()
  return (
    <button
      type="button"
      data-testid="balance-probe"
      onClick={() => applyCreditDelta(-1)}
    >
      {balance}
    </button>
  )
}

function renderPill() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <CreditProvider>
          <BalanceProbe />
          <CreditsPill />
        </CreditProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

function authenticatedUser(
  overrides: Partial<SessionShape['user']> = {},
): SessionShape['user'] {
  return {
    email: 'a@b.dz',
    locale: 'en',
    tier: 'free',
    credits_balance: 15,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CreditsPill visibility', () => {
  it('renders nothing for guests', () => {
    useSessionMock.mockReturnValue({ isAuthenticated: false, status: 'guest', user: null })
    renderPill()
    expect(screen.queryByTestId('credits-pill')).not.toBeInTheDocument()
  })

  it('renders nothing while the session is loading', () => {
    useSessionMock.mockReturnValue({ isAuthenticated: false, status: 'loading', user: null })
    renderPill()
    expect(screen.queryByTestId('credits-pill')).not.toBeInTheDocument()
  })

  it('renders the pill for an authenticated user', () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser(),
    })
    renderPill()
    expect(screen.getByTestId('credits-pill')).toBeInTheDocument()
  })
})

describe('CreditsPill anatomy (default)', () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'free', credits_balance: 15 }),
    })
  })

  it('is a link to /credits with the AC tokens', () => {
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    expect(pill.tagName).toBe('A')
    expect(pill).toHaveAttribute('href', '/credits')
    expect(pill.className).toContain('rounded-full')
    expect(pill.className).toContain('h-7')
    expect(pill.className).toContain('bg-muted')
    expect(pill.className).toContain('text-foreground')
  })

  it('shows the balance in text-data with tabular-nums and Western numerals', () => {
    renderPill()
    const balance = screen.getByTestId('credits-pill-balance')
    expect(balance.className).toContain('text-data')
    expect(balance.className).toContain('tabular-nums')
    expect(balance).toHaveTextContent('15')
  })

  it('precedes the balance with a decorative coin icon', () => {
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    const icon = pill.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.previousElementSibling).toBeNull()
  })

  it('carries an aria-label with the remaining-credits message', () => {
    renderPill()
    expect(screen.getByTestId('credits-pill')).toHaveAccessibleName(
      'common.credits.remaining',
    )
  })

  it('has NO alert-triangle and NO tooltip in the default state', () => {
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    expect(pill.querySelector('[data-testid="credits-pill-warning-icon"]')).toBeNull()
    expect(screen.queryByText('common.credits.low_tooltip')).not.toBeInTheDocument()
  })
})

describe('CreditsPill warning state (paid only)', () => {
  it('shifts to warning tones with a persistent alert-triangle and tooltip for Starter <=10', () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'starter', credits_balance: 10 }),
    })
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    expect(pill.className).toContain('bg-warning-container')
    expect(pill.className).toContain('text-warning-on-container')
    const warning = screen.getByTestId('credits-pill-warning-icon')
    expect(warning.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows the warning tooltip on focus (keyboard reachable)', async () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'starter', credits_balance: 8 }),
    })
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    fireEvent.focus(pill)
    expect(await screen.findByText('common.credits.low_tooltip')).toBeInTheDocument()
  })

  it('includes the low-credit warning in the aria-label (not color-only)', () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'starter', credits_balance: 5 }),
    })
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    expect(pill).toHaveAccessibleName(
      'common.credits.remaining — common.credits.low_tooltip',
    )
  })

  it('keeps the default tones for Starter above 10', () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'starter', credits_balance: 11 }),
    })
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    expect(pill.className).toContain('bg-muted')
    expect(pill.className).not.toContain('warning-container')
  })

  it('keeps the default tones for FREE users at or below 10 (paid-only warning)', () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'free', credits_balance: 5 }),
    })
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    expect(pill.className).toContain('bg-muted')
    expect(pill.className).not.toContain('warning-container')
    expect(screen.queryByTestId('credits-pill-warning-icon')).toBeNull()
  })
})

describe('CreditsPill zero state', () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'starter', credits_balance: 0 }),
    })
  })

  it('shifts to danger tones for ANY tier', () => {
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    expect(pill.className).toContain('bg-danger-container')
    expect(pill.className).toContain('text-danger-on-container')
  })

  it('fires the recovery-stub toast on click instead of navigating', () => {
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    fireEvent.click(pill)
    expect(screen.getByText('common.credits.no_credits')).toBeInTheDocument()
    expect(screen.getByTestId('credits-pill')).toHaveAttribute('href', '/credits')
  })
})

describe('CreditsPill announcement', () => {
  it('announces a balance DECREASE through the sr-only status region', async () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'free', credits_balance: 5 }),
    })
    renderPill()
    expect(screen.getByTestId('pill-announcer')).toHaveTextContent('')
    fireEvent.click(screen.getByTestId('balance-probe'))
    await waitFor(() =>
      expect(screen.getByTestId('pill-announcer')).toHaveTextContent(
        'common.credits.updated',
      ),
    )
  })

  it('never announces on mount (prevBalance null guard)', () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'free', credits_balance: 5 }),
    })
    renderPill()
    expect(screen.getByTestId('pill-announcer')).toHaveTextContent('')
  })

  it('does NOT announce an INCREASE (rollback/restore path)', async () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'free', credits_balance: 5 }),
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const DeltaProbe = ({ delta }: { delta: number }) => {
      const { applyCreditDelta } = useCredits()
      return (
        <button
          type="button"
          data-testid={`delta-${delta}`}
          onClick={() => applyCreditDelta(delta)}
        >
          probe
        </button>
      )
    }
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <CreditProvider>
            <DeltaProbe delta={-1} />
            <DeltaProbe delta={1} />
            <CreditsPill />
          </CreditProvider>
        </ToastProvider>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByTestId('delta--1'))
    await waitFor(() =>
      expect(screen.getByTestId('pill-announcer')).toHaveTextContent(
        'common.credits.updated',
      ),
    )
    // The rollback +1 restores the balance: the announcer clears and never
    // fires again (increase-only paths are silent — D3 decrease-only).
    fireEvent.click(screen.getByTestId('delta-1'))
    await waitFor(() => expect(screen.getByTestId('pill-announcer')).toHaveTextContent(''))
  })

  it('treats a baseline reset as mount-like — a renewal grant never announces a false DECREASE', async () => {
    // Sally's 5.3 pill-trap handoff: the 5.6 success flow bumps the baseline
    // nonce before the grant-announced balance lands (e.g. a renewal's pool
    // math 250 → 200). The pill must NOT announce the drop.
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'starter', credits_balance: 250 }),
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const ResetProbe = () => {
      const { applyCreditDelta, resetBaseline } = useCredits()
      return (
        <button
          type="button"
          data-testid="reset-probe"
          onClick={() => {
            resetBaseline()
            applyCreditDelta(-50)
          }}
        >
          probe
        </button>
      )
    }
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <CreditProvider>
            <ResetProbe />
            <CreditsPill />
          </CreditProvider>
        </ToastProvider>
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('pill-announcer')).toHaveTextContent('')
    // The success-flow ordering: baseline reset first, THEN the balance
    // update lands — the diff reads the reset baseline, no announcement.
    fireEvent.click(screen.getByTestId('reset-probe'))
    await waitFor(() => expect(screen.getByTestId('credits-pill-balance')).toHaveTextContent('200'))
    await waitFor(() => expect(screen.getByTestId('pill-announcer')).toHaveTextContent(''))
  })

  it('keeps the baseline reset pending until the grant balance arrives in a LATER frame (review P1)', async () => {
    // The production flow never batches reset+balance like the test above:
    // the StatusCard bumps the nonce and calls refresh() in one effect; the
    // grant-announced balance lands a frame later via the async /me probe.
    // The deferred capture must land on the NEW balance — a subsequent real
    // spend must still announce normally.
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'starter', credits_balance: 250 }),
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const SplitFrameProbe = () => {
      const { applyCreditDelta, resetBaseline } = useCredits()
      return (
        <button
          type="button"
          data-testid="split-probe"
          onClick={() => {
            // Frame A: the success effect — nonce bump only.
            resetBaseline()
          }}
        >
          probe
        </button>
      )
    }
    const DeltaProbe = ({ delta }: { delta: number }) => {
      const { applyCreditDelta } = useCredits()
      return (
        <button
          type="button"
          data-testid={`split-delta-${delta}`}
          onClick={() => applyCreditDelta(delta)}
        >
          probe
        </button>
      )
    }
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <CreditProvider>
            <SplitFrameProbe />
            <DeltaProbe delta={-50} />
            <DeltaProbe delta={-1} />
            <CreditsPill />
          </CreditProvider>
        </ToastProvider>
      </QueryClientProvider>,
    )
    // Frame A: nonce bump with the PRE-grant balance still rendered.
    fireEvent.click(screen.getByTestId('split-probe'))
    await waitFor(() => expect(screen.getByTestId('credits-pill-balance')).toHaveTextContent('250'))
    expect(screen.getByTestId('pill-announcer')).toHaveTextContent('')
    // Frame B: the grant-announced balance lands (250 → 200) — deferred
    // capture, no false DECREASE announcement.
    fireEvent.click(screen.getByTestId('split-delta--50'))
    await waitFor(() => expect(screen.getByTestId('credits-pill-balance')).toHaveTextContent('200'))
    expect(screen.getByTestId('pill-announcer')).toHaveTextContent('')
    // Frame C: a REAL subsequent spend (200 → 199) still announces.
    fireEvent.click(screen.getByTestId('split-delta--1'))
    await waitFor(() =>
      expect(screen.getByTestId('pill-announcer')).toHaveTextContent(
        'common.credits.updated',
      ),
    )
  })
})

describe('CreditsPill RTL smoke', () => {
  it('uses no physical-property classes', () => {
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: authenticatedUser({ tier: 'starter', credits_balance: 5 }),
    })
    renderPill()
    const pill = screen.getByTestId('credits-pill')
    expect(pill.className).not.toMatch(/\b(left|right|ml-|mr-|pl-|pr-|text-left|text-right)\b/)
  })
})
