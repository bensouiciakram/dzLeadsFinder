import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FailedRenewalBanner } from '@/components/layout/FailedRenewalBanner'

const hoisted = vi.hoisted(() => ({
  plan: vi.fn(),
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

function statusPlan(status: string | null) {
  return {
    tier: status === null || status === 'expired' ? 'free' : 'starter',
    status,
    renews_on: status === null ? null : '2026-09-30',
    balances: { subscription_balance: 120, pack_balance: 0, display_balance: 120 },
  }
}

function renderBanner(plan: unknown) {
  hoisted.plan.mockResolvedValue(plan)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <FailedRenewalBanner />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  hoisted.plan.mockReset()
  hoisted.redirect.mockReset()
  hoisted.sessionUser = {
    email: 'a@b.dz',
    locale: 'en',
    tier: 'starter',
  }
})

describe('FailedRenewalBanner — the persistent failed-renewal banner (FR-28)', () => {
  it('renders the danger-toned 40px strip with the AC copy when status is failed_renewal', async () => {
    const { container } = renderBanner(statusPlan('failed_renewal'))
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveClass('bg-danger-container')
    expect(banner).toHaveClass('text-danger-on-container')
    expect(banner).toHaveClass('min-h-10')
    // The AC copy verbatim (the current en.json value; Task 7 rewrites it
    // to the AC sentence — the rich-text link is the second clause).
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('is non-dismissible — no close button anywhere', async () => {
    const { container } = renderBanner(statusPlan('failed_renewal'))
    await screen.findByRole('alert')
    expect(container.querySelector('button')).toBeNull()
    expect(screen.queryByLabelText(/close/i)).toBeNull()
  })

  it('renders the Chargily update-payment action as a link performing the retry redirect', async () => {
    renderBanner(statusPlan('failed_renewal'))
    const banner = await screen.findByRole('alert')
    const link = banner.querySelector('a')
    expect(link).not.toBeNull()
    expect(link).toHaveClass('underline')
    // Review P1 pin: the AC clause lives INSIDE the <update>…</update>
    // tags — the anchor must carry the clause text (the 5.7-era
    // {update}-value pattern rendered an EMPTY anchor).
    expect(link).toHaveTextContent(
      'update your payment method to keep Starter',
    )
    fireEvent.click(link as HTMLAnchorElement)
    expect(hoisted.redirect).toHaveBeenCalledWith('subscription', 1500)
  })

  it('does not render for active, expired, free (null) or guest users', async () => {
    const { unmount } = renderBanner(statusPlan('active'))
    await waitFor(() => expect(hoisted.plan).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()

    renderBanner(statusPlan('expired'))
    await waitFor(() => expect(hoisted.plan).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()

    renderBanner(statusPlan(null))
    await waitFor(() => expect(hoisted.plan).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()

    hoisted.sessionUser = null
    renderBanner(statusPlan('failed_renewal'))
    await waitFor(() => expect(hoisted.plan).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
