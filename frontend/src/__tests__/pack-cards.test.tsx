import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { PackCards } from '@/components/billing/PackCards'
import type { PacksResult } from '@/lib/api/billing-service'
import type { BillingPhase } from '@/hooks/useBilling'
import { navigator } from '@/lib/api/http-client'

const hoisted = vi.hoisted(() => ({
  createCheckout: vi.fn(),
}))

vi.mock('next-intl', async () => {
  const en = (await import('../../messages/en.json')).default as Record<
    string,
    unknown
  >
  function lookup(key: string): string {
    let node: unknown = en
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null) return key
      node = (node as Record<string, unknown>)[part]
      if (node === undefined) return key
    }
    return typeof node === 'string' ? node : key
  }
  return {
    useLocale: () => 'en',
    useTranslations: (ns?: string) => {
      const fn = (key: string, params?: Record<string, unknown>): ReactNode => {
        const template = lookup(ns === undefined ? key : `${ns}.${key}`)
        if (params === undefined) return template
        const parts: ReactNode[] = []
        const re = /\{(\w+)\}/g
        let last = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(template)) !== null) {
          if (m.index > last) parts.push(template.slice(last, m.index))
          const value = params[m[1]]
          parts.push(
            typeof value === 'function' ? (value as () => ReactNode)() : (value as ReactNode),
          )
          last = m.index + m[0].length
        }
        if (last < template.length) parts.push(template.slice(last))
        return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
      }
      fn.rich = (key: string, params?: Record<string, unknown>): ReactNode => fn(key, params)
      return fn
    },
  }
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

const PACKS: PacksResult = {
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

function renderCards(packs: PacksResult | null, phase: BillingPhase) {
  return render(<PackCards packs={packs} phase={phase} />)
}

beforeEach(() => {
  hoisted.createCheckout.mockReset()
  hoisted.createCheckout.mockResolvedValue({
    checkout_url: 'https://pay.chargily.com/x',
    checkout_id: 'chk-x',
  })
  vi.spyOn(navigator, 'assign').mockImplementation(() => {})
})

describe('PackCards', () => {
  it('renders two cards side by side with the D15 anatomy', () => {
    const { container } = renderCards(PACKS, 'success')

    expect(screen.getByRole('heading', { name: 'Add-on Credit Packs' })).toBeInTheDocument()
    expect(container.querySelector('div.grid')).not.toBeNull()

    const cards = container.querySelectorAll('div.relative')
    expect(cards).toHaveLength(2)

    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('500 DZD')).toBeInTheDocument()
    expect(screen.getByText('1,500 DZD')).toBeInTheDocument()
    expect(screen.getByText('6.7 DZD/credit')).toBeInTheDocument()
    expect(screen.getByText('6.0 DZD/credit')).toBeInTheDocument()
    expect(screen.getAllByText('Never expires')).toHaveLength(2)
  })

  it('shows the best-value badge only on the 250-credit pack', () => {
    renderCards(PACKS, 'success')
    const badges = screen.getAllByText('Best value')
    expect(badges).toHaveLength(1)
    expect(badges[0].closest('div.relative')).toHaveTextContent('250')
    expect(badges[0].closest('div.relative')).not.toHaveTextContent('75')
  })

  it('renders the never-expires check icon as aria-hidden', () => {
    const { container } = renderCards(PACKS, 'success')
    const check = container.querySelector('span[aria-hidden="true"]')
    expect(check).not.toBeNull()
  })

  it('buys the 500 pack via create-checkout and redirects', async () => {
    renderCards(PACKS, 'success')

    const buyButtons = screen.getAllByRole('button', { name: 'Buy' })
    fireEvent.click(buyButtons[0])

    await waitFor(() => expect(hoisted.createCheckout).toHaveBeenCalledWith('pack', 500))
    await waitFor(() =>
      expect(navigator.assign).toHaveBeenCalledWith('https://pay.chargily.com/x'),
    )
  })

  it('buys the 1500 pack with its amount', async () => {
    renderCards(PACKS, 'success')

    const buyButtons = screen.getAllByRole('button', { name: 'Buy' })
    fireEvent.click(buyButtons[1])

    await waitFor(() => expect(hoisted.createCheckout).toHaveBeenCalledWith('pack', 1500))
  })

  it('shows an inline error when the checkout fails', async () => {
    hoisted.createCheckout.mockRejectedValue(new Error('boom'))
    renderCards(PACKS, 'success')

    fireEvent.click(screen.getAllByRole('button', { name: 'Buy' })[0])

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong'),
    )
    expect(navigator.assign).not.toHaveBeenCalled()
  })

  it('shows the loading state', () => {
    renderCards(null, 'loading')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    renderCards(null, 'error')
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('renders nothing while idle', () => {
    const { container } = renderCards(null, 'idle')
    expect(container).toBeEmptyDOMElement()
  })
})
