import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { BillingPage } from '@/components/billing/BillingPage'
import type { PlanResult } from '@/lib/api/billing-service'

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
})
