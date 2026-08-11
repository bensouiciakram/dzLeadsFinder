import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { PaymentHistoryTable } from '@/components/billing/PaymentHistoryTable'
import { SUPPORT_EMAIL, type HistoryResult } from '@/lib/api/billing-service'
import type { BillingPhase } from '@/hooks/useBilling'

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

const HISTORY: HistoryResult = {
  results: [
    {
      id: 'txn-1',
      date: '2026-08-07T12:00:00+01:00',
      amount_dzd: 1500,
      type: 'subscription_creation',
      status: 'succeeded',
      credits_granted: 200,
    },
    {
      id: 'txn-2',
      date: '2026-08-08T12:00:00+01:00',
      amount_dzd: 500,
      type: 'pack_purchase',
      status: 'failed',
      credits_granted: null,
    },
    {
      id: 'txn-3',
      date: '2026-08-09T12:00:00+01:00',
      amount_dzd: 1500,
      type: 'subscription_renewal',
      status: 'pending',
      credits_granted: null,
    },
    {
      id: 'txn-4',
      date: '2026-08-10T12:00:00+01:00',
      amount_dzd: 500,
      type: 'pack_purchase',
      status: 'refunded',
      credits_granted: 75,
    },
  ],
}

function renderTable(history: HistoryResult | null, phase: BillingPhase) {
  return render(<PaymentHistoryTable history={history} phase={phase} />)
}

describe('PaymentHistoryTable', () => {
  it('renders the four columns with the localized labels', () => {
    renderTable(HISTORY, 'success')

    expect(screen.getByRole('heading', { name: 'Payment History' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
  })

  it('renders all four statuses with their labels', () => {
    renderTable(HISTORY, 'success')

    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Refunded')).toBeInTheDocument()
  })

  it('localizes the type codes', () => {
    renderTable(HISTORY, 'success')

    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(screen.getByText('Monthly renewal')).toBeInTheDocument()
    expect(screen.getAllByText('Credit pack purchase')).toHaveLength(2)
  })

  it('renders amounts with latn grouping and the currency', () => {
    renderTable(HISTORY, 'success')
    expect(screen.getAllByText('1,500 DZD')).toHaveLength(2)
    expect(screen.getAllByText('500 DZD')).toHaveLength(2)
  })

  it('renders status dots with aria-hidden and the status color classes', () => {
    const { container } = renderTable(HISTORY, 'success')
    const dots = container.querySelectorAll('span[aria-hidden="true"]')
    expect(dots).toHaveLength(4)
    expect(dots[0].className).toContain('bg-success')
    expect(dots[1].className).toContain('bg-danger')
    expect(dots[2].className).toContain('bg-warning')
    expect(dots[3].className).toContain('bg-muted-foreground')
  })

  it('renders the failed-row explanatory note with a mailto support link', () => {
    renderTable(HISTORY, 'success')

    expect(
      screen.getByText((content) => content.includes('Payment failed. Contact')),
    ).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'support' })
    expect(link.getAttribute('href')).toBe(`mailto:${SUPPORT_EMAIL}`)
  })

  it('renders the empty state', () => {
    renderTable({ results: [] }, 'success')
    expect(screen.getByText('No payments yet')).toBeInTheDocument()
  })

  it('shows the loading state', () => {
    renderTable(null, 'loading')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    renderTable(null, 'error')
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('renders nothing while idle', () => {
    const { container } = renderTable(null, 'idle')
    expect(container).toBeEmptyDOMElement()
  })
})
