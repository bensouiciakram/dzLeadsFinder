import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { BillingPage } from '@/components/billing/BillingPage'
import type { PlanResult } from '@/lib/api/billing-service'

const upgradeOpenMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/providers/UpgradeDialogProvider', () => ({
  useUpgradeDialog: () => ({
    open: upgradeOpenMock,
    close: vi.fn(),
    isOpen: false,
  }),
}))

const hoisted = vi.hoisted(() => ({
  billing: {
    plan: null as PlanResult | null,
    packs: null as unknown,
    history: null as unknown,
    planPhase: 'loading',
    packsPhase: 'loading',
    historyPhase: 'loading',
    cancel: { mutate: vi.fn(), isPending: false, isError: false, error: null },
  },
}))

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({
    isAuthenticated: true,
    status: 'authenticated',
    user: { email: 'a@b.dz', locale: 'en', tier: 'starter', credits_balance: 120 },
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('@/hooks/useBilling', () => ({
  useBilling: () => hoisted.billing,
}))

const statusCardProps = vi.hoisted(() => ({
  checkout: null as { checkout_id: string; started_at: string } | null,
  fallback: null as 'success' | 'failure' | null,
}))

vi.mock('@/components/billing/StatusCard', () => ({
  StatusCard: ({ checkout, fallback }: { checkout: unknown; fallback: unknown }) => {
    statusCardProps.checkout = checkout as never
    statusCardProps.fallback = fallback as never
    if (checkout === null && fallback === null) return null
    return <div data-testid="status-card" />
  },
}))

const ACTIVE_PLAN: PlanResult = {
  tier: 'starter',
  status: 'active',
  renews_on: '2026-09-30',
  balances: { subscription_balance: 120, pack_balance: 75, display_balance: 195 },
}

const PACKS = {
  packs: [
    {
      amount: 500,
      credits: 75,
      description: 'DZLeads Pack — 75 credits, never expires',
      unit_price: '6.7',
      never_expires: true,
      best_value: false,
    },
    {
      amount: 1500,
      credits: 250,
      description: 'DZLeads Pack — 250 credits, never expires',
      unit_price: '6.0',
      never_expires: true,
      best_value: true,
    },
  ],
  never_expires: true,
}

const HISTORY = { results: [] }

function activeBilling() {
  hoisted.billing.plan = ACTIVE_PLAN
  hoisted.billing.packs = PACKS
  hoisted.billing.history = HISTORY
  hoisted.billing.planPhase = 'success'
  hoisted.billing.packsPhase = 'success'
  hoisted.billing.historyPhase = 'success'
}

function freeBilling() {
  hoisted.billing.plan = {
    tier: 'free',
    status: null,
    renews_on: null,
    balances: { subscription_balance: 0, pack_balance: 0, display_balance: 15 },
  }
  hoisted.billing.packs = PACKS
  hoisted.billing.history = HISTORY
  hoisted.billing.planPhase = 'success'
  hoisted.billing.packsPhase = 'success'
  hoisted.billing.historyPhase = 'success'
}

describe('BillingPage', () => {
  beforeEach(() => {
    statusCardProps.checkout = null
    statusCardProps.fallback = null
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/en/billing')
  })

  it('renders the four stacked sections for an active subscriber', () => {
    activeBilling()
    render(<BillingPage />)

    expect(screen.getByRole('heading', { name: 'Billing & Plans' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Current Plan' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Add-on Credit Packs' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Payment History' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument()
  })

  it('omits the Danger Zone for free users', () => {
    freeBilling()
    render(<BillingPage />)

    expect(screen.getByRole('heading', { name: 'Current Plan' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Danger Zone' })).not.toBeInTheDocument()
  })

  it('wires the cancel flow through the page to the mutation', async () => {
    activeBilling()
    render(<BillingPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))

    await waitFor(() => expect(hoisted.billing.cancel.mutate).toHaveBeenCalled())
  })

  it('renders no status card without an entry or a return param', () => {
    activeBilling()
    render(<BillingPage />)
    expect(screen.queryByTestId('status-card')).toBeNull()
  })

  it('renders the status card when a pending checkout entry exists (John V3 entry path)', () => {
    activeBilling()
    window.sessionStorage.setItem(
      'billing.pending_checkout',
      JSON.stringify({
        checkout_id: 'checkout_abc',
        started_at: '2026-08-11T12:00:00+01:00',
      }),
    )
    render(<BillingPage />)
    expect(screen.getByTestId('status-card')).toBeInTheDocument()
    expect(statusCardProps.checkout).toEqual({
      checkout_id: 'checkout_abc',
      started_at: '2026-08-11T12:00:00+01:00',
    })
    expect(statusCardProps.fallback).toBeNull()
  })

  it('uses the ?status=success param as a static fallback when no entry exists', () => {
    activeBilling()
    window.history.replaceState({}, '', '/en/billing?status=success')
    render(<BillingPage />)
    expect(screen.getByTestId('status-card')).toBeInTheDocument()
    expect(statusCardProps.checkout).toBeNull()
    expect(statusCardProps.fallback).toBe('success')
  })

  it('uses the ?status=failure param as a static fallback when no entry exists', () => {
    activeBilling()
    window.history.replaceState({}, '', '/en/billing?status=failure')
    render(<BillingPage />)
    expect(statusCardProps.fallback).toBe('failure')
  })

  it('strips the status param after the first render (no re-trigger on refresh)', () => {
    activeBilling()
    window.history.replaceState({}, '', '/en/billing?status=success')
    render(<BillingPage />)
    expect(window.location.search).not.toContain('status=')
  })

  it('lets the entry path win when both the entry and the param exist', () => {
    activeBilling()
    window.history.replaceState({}, '', '/en/billing?status=failure')
    window.sessionStorage.setItem(
      'billing.pending_checkout',
      JSON.stringify({
        checkout_id: 'checkout_abc',
        started_at: '2026-08-11T12:00:00+01:00',
      }),
    )
    render(<BillingPage />)
    expect(statusCardProps.checkout).not.toBeNull()
    expect(statusCardProps.fallback).toBeNull()
  })

  it('strips the status param on the entry-wins path too (review P3)', () => {
    // The param must not survive an entry-wins session — after the stash
    // clears (terminal state), a refresh would otherwise re-trigger the
    // static fallback card.
    activeBilling()
    window.history.replaceState({}, '', '/en/billing?status=failure')
    window.sessionStorage.setItem(
      'billing.pending_checkout',
      JSON.stringify({
        checkout_id: 'checkout_abc',
        started_at: '2026-08-11T12:00:00+01:00',
      }),
    )
    render(<BillingPage />)
    expect(window.location.search).not.toContain('status=')
  })
})
