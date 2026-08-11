import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RecoveryDialogProvider,
  useRecoveryDialog,
} from '@/components/providers/RecoveryDialogProvider'

const hoisted = vi.hoisted(() => ({
  packs: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/api/billing-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/billing-service')>()
  return {
    ...actual,
    billingService: {
      ...actual.billingService,
      packs: hoisted.packs,
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

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({
    user: { email: 'a@b.dz', locale: 'en', tier: 'starter' },
  }),
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
      const fn = (key: string, params?: Record<string, unknown>): ReactNode =>
        lookup(ns === undefined ? key : `${ns}.${key}`)
      fn.rich = (key: string): ReactNode =>
        lookup(ns === undefined ? key : `${ns}.${key}`)
      return fn
    },
  }
})

const PACKS = {
  packs: [
    {
      amount: 500,
      credits: 75,
      description: '75 credits',
      unit_price: '6.7',
      never_expires: true,
      best_value: false,
    },
    {
      amount: 1500,
      credits: 250,
      description: '250 credits',
      unit_price: '6.0',
      never_expires: true,
      best_value: true,
    },
  ],
  never_expires: true,
}

async function flushRaf(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function Probe() {
  const { open } = useRecoveryDialog()
  return (
    <button type="button" data-testid="probe-trigger" onClick={open}>
      open
    </button>
  )
}

function renderDialog() {
  hoisted.packs.mockResolvedValue(PACKS)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RecoveryDialogProvider>
        <Probe />
      </RecoveryDialogProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  hoisted.packs.mockReset()
  hoisted.redirect.mockReset()
})

describe('RecoveryDialog — the Starter 0-credit top-up surface (5.7)', () => {
  it('opens from the shared trigger with the packs title and both pack purchase paths', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // ZERO new message keys (Sally M1): the packs.title header + the
    // pack-card copy (real en.json strings via the lookup mock).
    expect(screen.getByText('Add-on Credit Packs')).toBeInTheDocument()
    expect(await screen.findByText('75')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getAllByText('Never expires')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Buy' })).toHaveLength(2)
  })

  it('routes each Buy through the shared create-checkout pack flow', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    const buy = await screen.findAllByRole('button', { name: 'Buy' })
    fireEvent.click(buy[0])
    expect(hoisted.redirect).toHaveBeenCalledWith('pack', 500)
    fireEvent.click(buy[1])
    expect(hoisted.redirect).toHaveBeenCalledWith('pack', 1500)
  })

  it('traps focus: initial focus lands on the first Buy', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    await screen.findByText('75')
    await flushRaf()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        document.querySelector('[data-recovery-first-buy]'),
      ),
    )
  })

  it('closes on Esc and restores focus to the invoking control', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await flushRaf()
    expect(document.activeElement).toBe(screen.getByTestId('probe-trigger'))
    // Never redirects on close (the upgrade-dialog discipline).
    expect(hoisted.redirect).not.toHaveBeenCalled()
  })

  it('renders the close X with the common close label', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })
})
