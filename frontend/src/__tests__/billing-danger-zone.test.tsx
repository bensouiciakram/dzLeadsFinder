import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { DangerZone } from '@/components/billing/DangerZone'
import type { PlanResult } from '@/lib/api/billing-service'
import type { BillingPhase } from '@/hooks/useBilling'

// Base UI schedules dialog focus via requestAnimationFrame — tests flush
// it with an rAF round-trip before asserting focus-dependent behavior.
async function flushRaf(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

const ACTIVE_PLAN: PlanResult = {
  tier: 'starter',
  status: 'active',
  renews_on: '2026-09-30',
  balances: { subscription_balance: 120, pack_balance: 75, display_balance: 195 },
}

function cancelApi(overrides: Partial<{ isPending: boolean; isError: boolean }> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    ...overrides,
  }
}

function renderZone(
  plan: PlanResult | null,
  phase: BillingPhase,
  overrides: Partial<{ isPending: boolean; isError: boolean }> = {},
) {
  const api = cancelApi(overrides)
  const view = render(<DangerZone plan={plan} phase={phase} cancel={api} />)
  return { api, rerender: () => view.rerender(<DangerZone plan={plan} phase={phase} cancel={api} />) }
}

describe('billing DangerZone', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders for an active subscription with the cancel CTA', () => {
    renderZone(ACTIVE_PLAN, 'success')
    expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel subscription' })).toBeInTheDocument()
  })

  it('renders nothing for failed_renewal subscriptions', () => {
    // John V2 amendment — the section renders only for the active state;
    // the backend 409s failed_renewal cancels (review P1).
    const { container } = render(
      <DangerZone
        plan={{ ...ACTIVE_PLAN, status: 'failed_renewal' }}
        phase="success"
        cancel={cancelApi()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for free users', () => {
    const { container } = render(<DangerZone plan={null} phase="success" cancel={cancelApi()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for cancelled subscriptions', () => {
    const { container } = render(
      <DangerZone
        plan={{ ...ACTIVE_PLAN, status: 'cancelled' }}
        phase="success"
        cancel={cancelApi()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for expired subscriptions', () => {
    const { container } = render(
      <DangerZone
        plan={{ ...ACTIVE_PLAN, status: 'expired' }}
        phase="success"
        cancel={cancelApi()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the AC confirmation copy with the access-until date', () => {
    renderZone(ACTIVE_PLAN, 'success')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))

    expect(
      screen.getByText((content) =>
        content.includes('You will keep access until') &&
        content.includes('No refund for the current cycle.'),
      ),
    ).toBeInTheDocument()
  })

  it('renders the access-until date inside a bdi isolate', () => {
    renderZone(ACTIVE_PLAN, 'success')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    expect(document.body.querySelector('bdi')).not.toBeNull()
  })

  it('moves initial focus to the safe control (Keep my subscription)', async () => {
    renderZone(ACTIVE_PLAN, 'success')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    await flushRaf()

    expect(screen.getByRole('button', { name: 'Keep my subscription' })).toHaveFocus()
  })

  it('confirms via the mutation and closes the dialog only on success', async () => {
    const { api, rerender } = renderZone(ACTIVE_PLAN, 'success')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    // While the dialog is open the trigger is hidden — the only matching
    // button is the in-dialog confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))

    expect(api.mutate).toHaveBeenCalled()
    // Pending/failed: the dialog stays open (review P2 — a synchronous
    // close would swallow the failure).
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    api.isSuccess = true
    rerender()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the dialog open and shows the in-dialog error when the cancellation fails', () => {
    renderZone(ACTIVE_PLAN, 'success', { isError: true })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('We could not cancel')
  })
})
