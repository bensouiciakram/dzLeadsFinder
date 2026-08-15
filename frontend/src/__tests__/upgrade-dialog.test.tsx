import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  UpgradeDialogProvider,
  useUpgradeDialog,
} from '@/components/providers/UpgradeDialogProvider'

const hoisted = vi.hoisted(() => ({
  redirect: vi.fn(),
}))

vi.mock('@/hooks/useCheckoutRedirect', () => ({
  useCheckoutRedirect: () => ({
    redirecting: false,
    error: false,
    redirect: hoisted.redirect,
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

// The Base UI initialFocus is rAF-scheduled (the DangerZone lesson).
async function flushRaf(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function Probe() {
  const { open } = useUpgradeDialog()
  return (
    <>
      <button type="button" data-testid="probe-trigger" onClick={() => open()}>
        open
      </button>
      <button
        type="button"
        data-testid="probe-trigger-reactivate"
        onClick={() => open('reactivate')}
      >
        open reactivate
      </button>
    </>
  )
}

function renderDialog() {
  return render(
    <UpgradeDialogProvider>
      <Probe />
    </UpgradeDialogProvider>,
  )
}

beforeEach(() => {
  hoisted.redirect.mockReset()
})

describe('UpgradeDialog — the single shared conversion surface (5.7 AC)', () => {
  it('opens the dialog from the shared trigger with the plan details', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    // The dialog anatomy (Sally M4): title, credits + price anchors,
    // inclusions list (the REAL strings — the homepage feature trio),
    // full-width Subscribe CTA. The billing.upgrade_dialog.* keys land in
    // Task 7 — the fallback key text renders today.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Upgrade to Starter')).toBeInTheDocument()
    expect(screen.getByText('200 credits/mo')).toBeInTheDocument()
    expect(screen.getByText('1,500 DZD/mo')).toBeInTheDocument()
    expect(screen.getByText('200 credits every month')).toBeInTheDocument()
    expect(screen.getByText('Search across all 58 wilayas')).toBeInTheDocument()
    expect(screen.getByText('Export to CSV or Excel')).toBeInTheDocument()
    expect(screen.getByText('Subscribe via Chargily')).toBeInTheDocument()
  })

  it('traps focus: initial focus lands on the Subscribe CTA', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        document.querySelector('[data-upgrade-subscribe]'),
      ),
    )
  })

  it('closes on Esc and restores focus to the invoking control', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The provider restores focus via rAF (the DangerZone lesson) — flush
    // it before asserting.
    await flushRaf()
    expect(document.activeElement).toBe(screen.getByTestId('probe-trigger'))
  })

  it('closes on overlay click and never redirects on close', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement?.querySelector('[data-dialog-backdrop]')
    if (backdrop !== null && backdrop !== undefined) {
      fireEvent.click(backdrop as HTMLElement)
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
    // "on close, the user is not redirected" (AC) — no navigation anywhere
    // in the close path.
    expect(hoisted.redirect).not.toHaveBeenCalled()
    await flushRaf()
    expect(document.activeElement).toBe(screen.getByTestId('probe-trigger'))
  })

  it('open() while open is a no-op (double-click guard)', async () => {
    renderDialog()
    const trigger = screen.getByTestId('probe-trigger')
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    await flushRaf()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('routes the Subscribe CTA through the checkout redirect', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    fireEvent.click(screen.getByText('Subscribe via Chargily'))
    expect(hoisted.redirect).toHaveBeenCalledWith('subscription', 1500)
  })

  it('renders the close X with the common close label', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger'))
    await flushRaf()
    // The real en.json common.actions.close resolves via the lookup mock.
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('renders the state-aware REACTIVATE title when opened with the reactivate intent (manual-review fix)', async () => {
    renderDialog()
    fireEvent.click(screen.getByTestId('probe-trigger-reactivate'))
    await flushRaf()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // The existing plan.reactivate string is reused ("Reactivate" — zero
    // new i18n keys); the default intent still shows "Upgrade to Starter".
    expect(screen.getByText('Reactivate')).toBeInTheDocument()
    expect(screen.queryByText('Upgrade to Starter')).toBeNull()
  })

  it('keeps open/close identity STABLE across open/close cycles (M7)', () => {
    const { result } = renderHook(() => useUpgradeDialog(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <UpgradeDialogProvider>{children}</UpgradeDialogProvider>
      ),
    })
    const firstOpen = result.current.open
    const firstClose = result.current.close
    act(() => result.current.open('reactivate'))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.intent).toBe('reactivate')
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
    act(() => result.current.open())
    expect(result.current.open).toBe(firstOpen)
    expect(result.current.close).toBe(firstClose)
    expect(result.current.intent).toBe('upgrade')
    // The double-click guard survives the identity stabilization.
    act(() => result.current.open('reactivate'))
    expect(result.current.intent).toBe('upgrade')
  })
})
