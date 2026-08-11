import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { PlanCard } from '@/components/billing/PlanCard'
import type { PlanResult } from '@/lib/api/billing-service'
import type { BillingPhase } from '@/hooks/useBilling'
import { navigator } from '@/lib/api/http-client'

const hoisted = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  upgradeOpen: vi.fn(),
}))

vi.mock('@/components/providers/UpgradeDialogProvider', () => ({
  useUpgradeDialog: () => ({
    open: hoisted.upgradeOpen,
    close: vi.fn(),
    isOpen: false,
  }),
}))

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

vi.mock('@/lib/api/billing-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/billing-service')>()
  return {
    ...actual,
    billingService: {
      createCheckout: hoisted.createCheckout,
    },
  }
})

const FREE_PLAN: PlanResult = {
  tier: 'free',
  status: null,
  renews_on: null,
  balances: { subscription_balance: 0, pack_balance: 15, display_balance: 15 },
}

function starterPlan(status: string): PlanResult {
  return {
    tier: 'starter',
    status,
    renews_on: '2026-09-30',
    balances: { subscription_balance: 120, pack_balance: 75, display_balance: 195 },
  }
}

function renderCard(plan: PlanResult | null, phase: BillingPhase) {
  return render(<PlanCard plan={plan} phase={phase} />)
}

beforeEach(() => {
  hoisted.createCheckout.mockReset()
  hoisted.upgradeOpen.mockReset()
  hoisted.createCheckout.mockResolvedValue({
    checkout_url: 'https://pay.chargily.com/x',
    checkout_id: 'chk-x',
  })
  vi.spyOn(navigator, 'assign').mockImplementation(() => {})
})

describe('PlanCard', () => {
  it('shows the free state with the display balance and an Upgrade CTA opening the dialog', async () => {
    renderCard(FREE_PLAN, 'success')

    expect(screen.getByRole('heading', { name: 'Current Plan' })).toBeInTheDocument()
    expect(screen.getByText('Free tier')).toBeInTheDocument()
    expect(screen.getByText('Credits')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    const upgrade = screen.getByRole('button', { name: 'Upgrade' })
    expect(upgrade).toBeInTheDocument()

    // 5.7 re-point (John V8 amendment 5): the Upgrade CTA opens the single
    // Upgrade Dialog — never a direct checkout (no dead stubs).
    fireEvent.click(upgrade)
    expect(hoisted.upgradeOpen).toHaveBeenCalledTimes(1)
    expect(hoisted.createCheckout).not.toHaveBeenCalled()
    expect(navigator.assign).not.toHaveBeenCalled()
  })

  it('shows the starter state with the cycle credits and no CTA', () => {
    renderCard(starterPlan('active'), 'success')

    expect(
      screen.getByText((content) => content.includes('Starter — 1,500 DZD/mo — renews on')),
    ).toBeInTheDocument()
    expect(screen.getByText('Credits left this cycle')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders the renewal date inside a bdi isolate', () => {
    const { container } = renderCard(starterPlan('active'), 'success')
    expect(container.querySelector('bdi')).not.toBeNull()
  })

  it('shows the cancelled state with role=status and a Reactivate CTA', async () => {
    renderCard(starterPlan('cancelled'), 'success')

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Cancelled — access until')
    expect(status).not.toHaveTextContent('Reactivate')
    expect(screen.getByText('Credits left this cycle')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
    await waitFor(() =>
      expect(hoisted.createCheckout).toHaveBeenCalledWith('subscription', 1500),
    )
  })

  it('shows the failed_renewal state with a retry CTA', () => {
    renderCard(starterPlan('failed_renewal'), 'success')

    expect(
      screen.getByText((content) => content.includes('Payment failed — access until')),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry payment' })).toBeInTheDocument()
  })

  it('shows the expired state with the display balance and a resubscribe CTA opening the dialog', () => {
    const expired: PlanResult = {
      tier: 'free',
      status: 'expired',
      renews_on: null,
      balances: { subscription_balance: 0, pack_balance: 40, display_balance: 40 },
    }
    renderCard(expired, 'success')

    expect(screen.getByText('Subscription ended')).toBeInTheDocument()
    expect(screen.getByText('Credits')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resubscribe' }))
    // 5.7 re-point: Resubscribe (the post-period cancelled state's home —
    // John V4) opens the single Upgrade Dialog.
    expect(hoisted.upgradeOpen).toHaveBeenCalledTimes(1)
  })

  it('shows the loading state', () => {
    renderCard(null, 'loading')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    renderCard(null, 'error')
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('renders nothing while idle', () => {
    const { container } = renderCard(null, 'idle')
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an inline error when the checkout fails (the recovery paths keep direct redirects)', async () => {
    hoisted.createCheckout.mockRejectedValue(new Error('boom'))
    renderCard(starterPlan('cancelled'), 'success')

    // Reactivate is a RECOVERY path (John V8 amendment 5) — it keeps the
    // direct create-checkout redirect + the inline role=alert error surface.
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong'))
    expect(navigator.assign).not.toHaveBeenCalled()
    expect(hoisted.upgradeOpen).not.toHaveBeenCalled()
  })
})
