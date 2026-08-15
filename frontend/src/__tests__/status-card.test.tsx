import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { StatusCard } from '@/components/billing/StatusCard'
import type { PendingCheckout } from '@/lib/billing/checkoutStorage'
import { PENDING_CHECKOUT_KEY } from '@/lib/billing/checkoutStorage'

const hoisted = vi.hoisted(() => ({
  status: vi.fn(),
  toast: vi.fn(),
  resetBaseline: vi.fn(),
  invalidate: vi.fn(),
  refresh: vi.fn(),
  applyConfirmedBalance: vi.fn(),
}))

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

vi.mock('@/lib/api/billing-service', () => ({
  billingService: {
    status: hoisted.status,
  },
  numerals: (value: number): string => new Intl.NumberFormat('en').format(value),
  SUPPORT_EMAIL: 'support@dzleadsfinder.com',
  PAYMENT_POLL_DEADLINE_MS: 60_000,
  PAYMENT_POLL_INTERVAL_MS: 5_000,
  TERMINAL_PAYMENT_STATUSES: new Set(['succeeded', 'failed', 'refunded']),
}))

vi.mock('@/lib/queryKeys/billing', () => ({
  billingKeys: {
    all: ['billing'],
    plan: (userKey: string) => ['billing', 'plan', userKey],
    packs: (userKey: string) => ['billing', 'packs', userKey],
    history: (userKey: string) => ['billing', 'history', userKey],
    status: (userKey: string, txnId: string) => ['billing', 'status', userKey, txnId],
  },
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: hoisted.invalidate }),
  }
})

vi.mock('@/components/providers/ToastProvider', () => ({
  useToast: () => ({ toast: hoisted.toast }),
}))

vi.mock('@/components/providers/CreditProvider', () => ({
  useCredits: () => ({ resetBaseline: hoisted.resetBaseline }),
}))

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({
    user: {
      email: 'a@b.dz',
      locale: 'en',
      tier: 'starter',
      credits_balance: 100,
    },
    refresh: hoisted.refresh,
  }),
}))

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'starter',
  credits_balance: 100,
}

// RELATIVE started_at (5.6-record lesson, applied 2026-08-12): a fixed
// ISO constant goes stale once the wall clock passes it — the deadline
// alarm (started_at + 60s) then fires immediately and the polling tests
// flip to timeout on every run. "5 seconds ago" keeps the deadline ~55s
// in the future forever.
const STARTED_AT = new Date(Date.now() - 5_000).toISOString()

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderCard(checkout: PendingCheckout | null) {
  return render(<StatusCard checkout={checkout} />, { wrapper })
}

beforeEach(() => {
  hoisted.status.mockReset()
  hoisted.toast.mockReset()
  hoisted.resetBaseline.mockReset()
  hoisted.invalidate.mockReset()
  hoisted.refresh.mockReset()
  hoisted.applyConfirmedBalance.mockReset()
  window.sessionStorage.clear()
})

describe('StatusCard', () => {
  it('renders nothing without a checkout', () => {
    renderCard(null)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders the polling state with role=status, spinner and confirming copy', async () => {
    hoisted.status.mockResolvedValue({
      id: null,
      status: 'pending',
      type: null,
      credits_granted: null,
      date: null,
    })
    renderCard({ checkout_id: 'checkout_abc', started_at: STARTED_AT })

    const card = await screen.findByRole('status')
    expect(card.className).toContain('bg-info-container')
    expect(card.className).toContain('text-info-on-container')
    expect(screen.getByText('Confirming payment…')).toBeInTheDocument()
    const spinner = card.querySelector('[data-testid="status-spinner"]')
    expect(spinner).not.toBeNull()
    expect(spinner?.getAttribute('aria-hidden')).toBe('true')
    // Non-blocking: the polling card holds no focusable elements.
    expect(card.querySelectorAll('a,button,input').length).toBe(0)
  })

  it('flips to the success state with the pack flavor and {n} credits', async () => {
    hoisted.status.mockResolvedValue({
      id: 'txn-1',
      status: 'succeeded',
      type: 'pack_purchase',
      credits_granted: 75,
      date: '2026-08-11T12:00:30+01:00',
    })
    renderCard({ checkout_id: 'checkout_abc', started_at: STARTED_AT })

    const card = await screen.findByText('75 credits added — pack credits never expire')
    expect(card.closest('[role="status"]')?.className).toContain('bg-success-container')
    expect(card.closest('[role="status"]')?.className).toContain(
      'text-success-on-container',
    )
    const check = card
      .closest('[role="status"]')
      ?.querySelector('[data-testid="status-success-check"]')
    expect(check?.getAttribute('aria-hidden')).toBe('true')
    // The success flow resets the pill baseline + refreshes the session.
    await waitFor(() => expect(hoisted.resetBaseline).toHaveBeenCalled())
    await waitFor(() => expect(hoisted.refresh).toHaveBeenCalled())
    // The polling stops and the stash is cleared.
    await waitFor(() =>
      expect(window.sessionStorage.getItem(PENDING_CHECKOUT_KEY)).toBeNull(),
    )
  })

  it('renders the subscription success flavor for subscription grants', async () => {
    hoisted.status.mockResolvedValue({
      id: 'txn-1',
      status: 'succeeded',
      type: 'subscription_creation',
      credits_granted: 200,
      date: '2026-08-11T12:00:30+01:00',
    })
    renderCard({ checkout_id: 'checkout_abc', started_at: STARTED_AT })

    const text = await screen.findByText('200 credits added')
    expect(text.closest('[role="status"]')?.className).toContain('bg-success-container')
    expect(
      screen.queryByText('200 credits added — pack credits never expire'),
    ).toBeNull()
  })

  it('flips to the failed state with the failure surface and a support link', async () => {
    hoisted.status.mockResolvedValue({
      id: 'txn-1',
      status: 'failed',
      type: 'pack_purchase',
      credits_granted: null,
      date: '2026-08-11T12:00:30+01:00',
    })
    renderCard({ checkout_id: 'checkout_abc', started_at: STARTED_AT })

    const card = await screen.findByRole('alert')
    expect(card.className).toContain('bg-danger-container')
    expect(card.className).toContain('text-danger-on-container')
    expect(
      screen.getByText((content) => content.includes('Payment failed. Contact')),
    ).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'support' })
    expect(link.getAttribute('href')).toBe('mailto:support@dzleadsfinder.com')
    // No retry or re-pay CTA — the support link is the only action.
    expect(screen.getAllByRole('link').length).toBe(1)
    expect(screen.queryByText(/retry|pay again|try again/i)).toBeNull()
  })

  it('flips the card BEFORE the toast appears (frame separation — Sally mandate 3)', async () => {
    hoisted.status.mockResolvedValue({
      id: 'txn-1',
      status: 'succeeded',
      type: 'pack_purchase',
      credits_granted: 75,
      date: '2026-08-11T12:00:30+01:00',
    })
    renderCard({ checkout_id: 'checkout_abc', started_at: STARTED_AT })

    // The card's success copy commits in frame 1...
    const card = await screen.findByText('75 credits added — pack credits never expire')
    expect(card).toBeInTheDocument()
    // ...and only THEN does the success toast fire (frame 2 — the toast is
    // invoked from an effect after the card state commit, so the role=status
    // announcement is queued before the toast's live region).
    await waitFor(() => expect(hoisted.toast).toHaveBeenCalled())
    const toastCall = hoisted.toast.mock.calls[0]
    expect(toastCall[0]).toBe('billing.status.success_pack')
    expect(toastCall[1]).toEqual({ n: '75' })
  })

  it('renders the timeout state info-toned with no spinner', async () => {
    hoisted.status.mockResolvedValue({
      id: null,
      status: 'pending',
      type: null,
      credits_granted: null,
      date: null,
    })
    const started = new Date(Date.now() - 61_000).toISOString()
    renderCard({ checkout_id: 'checkout_abc', started_at: started })

    const text = await screen.findByText('Payment received — credits will post shortly')
    const card = text.closest('[role="status"]')
    expect(card?.className).toContain('bg-info-container')
    expect(card?.querySelector('[data-testid="status-spinner"]')).toBeNull()
  })
})
