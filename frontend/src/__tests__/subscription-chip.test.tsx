import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionChip } from '@/components/layout/SubscriptionChip'
import { billingKeys } from '@/lib/queryKeys/billing'

const hoisted = vi.hoisted(() => ({
  plan: vi.fn(),
  openDialog: vi.fn(),
  redirect: vi.fn(),
  sessionUser: null as null | { email: string; locale: string; tier: string },
}))

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({ user: hoisted.sessionUser, isAuthenticated: true, status: 'authenticated' }),
}))

vi.mock('@/lib/api/billing-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/billing-service')>()
  return {
    ...actual,
    billingService: {
      ...actual.billingService,
      plan: hoisted.plan,
    },
  }
})

vi.mock('@/components/providers/UpgradeDialogProvider', () => ({
  useUpgradeDialog: () => ({
    open: hoisted.openDialog,
    close: vi.fn(),
    isOpen: false,
  }),
}))

vi.mock('@/hooks/useCheckoutRedirect', () => ({
  useCheckoutRedirect: () => ({
    redirecting: false,
    error: false,
    redirect: hoisted.redirect,
  }),
}))

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

function freePlan() {
  return {
    tier: 'free',
    status: null,
    renews_on: null,
    balances: { subscription_balance: 0, pack_balance: 0, display_balance: 15 },
  }
}

function statusPlan(status: string) {
  return {
    tier: 'starter',
    status,
    renews_on: '2026-09-30',
    balances: { subscription_balance: 120, pack_balance: 0, display_balance: 120 },
  }
}

async function renderChip(plan: unknown) {
  hoisted.plan.mockResolvedValue(plan)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SubscriptionChip />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('subscription-chip')).toBeInTheDocument())
}

beforeEach(() => {
  hoisted.plan.mockReset()
  hoisted.openDialog.mockReset()
  hoisted.redirect.mockReset()
  hoisted.sessionUser = {
    email: 'a@b.dz',
    locale: 'en',
    tier: 'free',
  }
})

describe('SubscriptionChip — free (no subscription row)', () => {
  it('renders the free variant as a whole-chip button opening the Upgrade Dialog', async () => {
    await renderChip(freePlan())
    const chip = screen.getByTestId('subscription-chip')
    expect(chip).toHaveClass('rounded-full')
    expect(chip).toHaveClass('border-primary')
    expect(chip).toHaveClass('text-primary')
    expect(chip.tagName).toBe('BUTTON')
    expect(screen.getByText('Free — Upgrade')).toBeInTheDocument()
    fireEvent.click(chip)
    expect(hoisted.openDialog).toHaveBeenCalledTimes(1)
  })
})

describe('SubscriptionChip — starter (active)', () => {
  it('renders the solid primary span with "renews on {date}" and the localized date in a bdi', async () => {
    const { container } = render(
      await (async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        hoisted.plan.mockResolvedValue(statusPlan('active'))
        return (
          <QueryClientProvider client={client}>
            <SubscriptionChip />
          </QueryClientProvider>
        )
      })(),
    )
    const chip = await screen.findByTestId('subscription-chip')
    expect(chip.tagName).toBe('SPAN')
    expect(chip).toHaveClass('bg-primary')
    expect(chip).toHaveClass('text-primary-foreground')
    // The real chip.starter template ("Starter — renews on {date}") — the
    // date renders inside a bdi isolate (localized month name + Western
    // numerals — the PlanCard precedent; TZ-independent assertion).
    expect(screen.getByText(/Starter — renews on/)).toBeInTheDocument()
    const bdi = container.querySelector('bdi')
    expect(bdi).not.toBeNull()
    expect(bdi).toHaveClass('tabular-nums')
  })

  it('is never focusable or clickable (status readout, not a CTA)', async () => {
    await renderChip(statusPlan('active'))
    const chip = screen.getByTestId('subscription-chip')
    expect(chip.tagName).toBe('SPAN')
    fireEvent.click(chip)
    expect(hoisted.openDialog).not.toHaveBeenCalled()
    expect(hoisted.redirect).not.toHaveBeenCalled()
  })
})

describe('SubscriptionChip — cancelled (access until date)', () => {
  it('renders the warning pair and clicking opens the Upgrade Dialog (the reactivation offer)', async () => {
    const { container } = render(
      await (async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        hoisted.plan.mockResolvedValue(statusPlan('cancelled'))
        return (
          <QueryClientProvider client={client}>
            <SubscriptionChip />
          </QueryClientProvider>
        )
      })(),
    )
    const chip = await screen.findByTestId('subscription-chip')
    expect(chip.tagName).toBe('BUTTON')
    expect(chip).toHaveClass('bg-warning-container')
    expect(chip).toHaveClass('text-warning-on-container')
    expect(screen.getByText('Cancelled — access until')).toBeInTheDocument()
    expect(container.querySelector('bdi')).not.toBeNull()
    fireEvent.click(chip)
    expect(hoisted.openDialog).toHaveBeenCalledTimes(1)
  })
})

describe('SubscriptionChip — failed_renewal', () => {
  it('renders the warning pair and clicking performs the retry-payment redirect', async () => {
    await renderChip(statusPlan('failed_renewal'))
    const chip = screen.getByTestId('subscription-chip')
    expect(chip.tagName).toBe('BUTTON')
    expect(chip).toHaveClass('bg-warning-container')
    // The verbatim amendment copy (John V2): "Starter — payment failed".
    expect(screen.getByText('Starter — payment failed')).toBeInTheDocument()
    fireEvent.click(chip)
    expect(hoisted.redirect).toHaveBeenCalledWith('subscription', 1500)
  })
})

describe('SubscriptionChip — expired', () => {
  it('renders the free variant (truthful after the tier sync) opening the Upgrade Dialog', async () => {
    await renderChip(statusPlan('expired'))
    const chip = screen.getByTestId('subscription-chip')
    expect(chip.tagName).toBe('BUTTON')
    expect(chip).toHaveClass('border-primary')
    expect(chip).toHaveClass('text-primary')
    expect(screen.getByText('Free — Upgrade')).toBeInTheDocument()
    fireEvent.click(chip)
    expect(hoisted.openDialog).toHaveBeenCalledTimes(1)
  })
})

describe('SubscriptionChip — status never driven by user.tier', () => {
  it('a starter-tier user with no subscription row renders the FREE variant (5.5 D8 discipline)', async () => {
    await renderChip({ ...freePlan(), tier: 'starter' })
    const chip = screen.getByTestId('subscription-chip')
    expect(screen.getByText('Free — Upgrade')).toBeInTheDocument()
    expect(chip).toHaveClass('border-primary')
  })
})
