import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

import { ExportModal } from '@/components/search/ExportModal'
import { exportService } from '@/lib/api/export-service'
import type { CreateExportResponse } from '@/lib/api/export-service'
import { navigator } from '@/lib/api/http-client'
import { useExport } from '@/hooks/useExport'
import { useExportPreview } from '@/hooks/useExportPreview'
import type { ExportPreview } from '@/hooks/useExportPreview'
import type { ExportError } from '@/hooks/useExport'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/providers/ToastProvider', () => ({
  useToast: () => ({ toast: toastMock }),
}))

const creditsMock = vi.hoisted(() => ({
  balance: 15,
  applyCreditDelta: vi.fn(),
  applyConfirmedBalance: vi.fn(),
}))
vi.mock('@/components/providers/CreditProvider', () => ({
  useCredits: () => creditsMock,
}))

vi.mock('@/lib/api/export-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/export-service')>()
  return {
    ...actual,
    exportService: { create: vi.fn() },
  }
})

vi.mock('@/lib/api/http-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/http-client')>()
  return {
    ...actual,
    navigator: { assign: vi.fn() },
  }
})

vi.mock('@/hooks/useExportPreview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useExportPreview')>()
  return {
    ...actual,
    useExportPreview: vi.fn(),
  }
})

vi.mock('@/hooks/useExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useExport')>()
  return {
    ...actual,
    useExport: vi.fn(),
  }
})

const PREVIEW: ExportPreview = {
  ids: ['p-1', 'p-2', 'p-3'],
  rows: [
    {
      id: 'p-1',
      name: 'Karim Benali',
      role: 'CEO',
      company_name: 'ACME Algérie',
      industry: null,
      wilaya_name: 'Oran',
      wilaya_code: 31,
      people_count: 0,
      revealed: true,
    },
    {
      id: 'p-2',
      name: 'Youcef K.',
      role: null,
      company_name: null,
      industry: null,
      wilaya_name: null,
      wilaya_code: null,
      people_count: 0,
      revealed: false,
    },
  ],
  revealedCount: 1,
  unrevealedCount: 2,
  totalRows: 3,
}

const FREE_PREVIEW: ExportPreview = {
  ids: ['p-1', 'p-2', 'p-3', 'p-4', 'p-5'],
  rows: PREVIEW.rows,
  revealedCount: 0,
  unrevealedCount: 5,
  totalRows: 5,
}

const RESULT: CreateExportResponse = {
  id: '11111111-2222-3333-4444-555555555555',
  format: 'csv',
  row_count: 3,
  revealed_count: 1,
  unrevealed_count: 2,
  credits_cost: 3,
  included_unrevealed: true,
  watermark: false,
  created_at: '2026-08-07T12:00:00Z',
  balances: { subscription_balance: 12, pack_balance: 0, display_balance: 12 },
}

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

type ModalProps = Partial<Parameters<typeof ExportModal>[0]>

function renderModal(client: QueryClient, overrides: ModalProps = {}) {
  const onOpenChange = vi.fn()
  const utils = render(
    <QueryClientProvider client={client}>
      <ExportModal
        open
        onOpenChange={onOpenChange}
        tab="people"
        filtersJson="{}"
        sort="name:asc"
        nonce={1}
        total={3}
        tier="starter"
        balance={15}
        {...overrides}
      />
    </QueryClientProvider>,
  )
  return { onOpenChange, ...utils }
}

function stubPreview(preview: ExportPreview | null, extras: Partial<ReturnType<typeof useExportPreview>> = {}) {
  vi.mocked(useExportPreview).mockReturnValue({
    preview,
    isCollecting: false,
    error: null,
    retry: vi.fn(),
    ...extras,
  })
}

function stubExport(error: ExportError | undefined, isPending = false, create = vi.fn()) {
  vi.mocked(useExport).mockReturnValue({
    create,
    isPending,
    error,
    reset: vi.fn(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubPreview(PREVIEW)
  stubExport(undefined)
})

describe('ExportModal — starter anatomy (ACs)', () => {
  it('renders the modal with the cost breakdown, balance-after, checkbox, preview and confirm', () => {
    renderModal(freshClient())
    expect(screen.getByText('export.modal.title')).toBeInTheDocument()
    expect(screen.getByText('export.modal.rows')).toBeInTheDocument()
    expect(screen.getByText('export.modal.cost_breakdown')).toBeInTheDocument()
    expect(screen.getByText('export.modal.balance_after')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByText('export.modal.preview_notice')).toBeInTheDocument()
    expect(screen.getByText('export.modal.confirm')).toBeInTheDocument()
  })

  it('interpolates the breakdown with Western numerals over the included set', () => {
    renderModal(freshClient())
    const breakdown = screen.getByText('export.modal.cost_breakdown')
    expect(breakdown.className).toContain('tabular-nums')
    const confirm = screen.getByText('export.modal.confirm')
    expect(confirm).toBeInTheDocument()
  })

  it('shows the balance-after as balance minus cost', () => {
    renderModal(freshClient())
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders a literal preview with the localized header, real rows and an ellipsis', () => {
    renderModal(freshClient())
    const previewBox = screen.getByLabelText('export.modal.preview_label')
    expect(previewBox).toHaveAttribute('dir', 'ltr')
    expect(within(previewBox).getByText(/Karim Benali/)).toBeInTheDocument()
    expect(within(previewBox).getByText(/Youcef K/)).toBeInTheDocument()
    expect(within(previewBox).getByText('…')).toBeInTheDocument()
  })

  it('offers both formats with CSV active by default', () => {
    renderModal(freshClient())
    const csv = screen.getByRole('button', { name: 'CSV' })
    const xlsx = screen.getByRole('button', { name: /Excel/ })
    expect(csv).toHaveAttribute('aria-pressed', 'true')
    expect(xlsx).toHaveAttribute('aria-pressed', 'false')
  })

  it('recomputes the cost to the revealed count when include_unrevealed is unchecked', () => {
    renderModal(freshClient())
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('14')).toBeInTheDocument()
  })

  it('switches the format toggle to Excel', () => {
    renderModal(freshClient())
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }))
    expect(screen.getByRole('button', { name: /Excel/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'CSV' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('submits the exact payload on confirm (record_ids only, format, include_unrevealed)', () => {
    const create = vi.fn()
    stubExport(undefined, false, create)
    renderModal(freshClient())
    fireEvent.click(screen.getByText('export.modal.confirm'))
    expect(create).toHaveBeenCalledWith({
      record_ids: ['p-1', 'p-2', 'p-3'],
      format: 'csv',
      include_unrevealed: true,
    })
  })

  it('closes and navigates to the download URL when the mutation succeeds', () => {
    const { onOpenChange } = renderModal(freshClient())
    const hookArgs = vi.mocked(useExport).mock.calls[0][0]
    hookArgs.onSuccess?.(RESULT)
    expect(navigator.assign).toHaveBeenCalledWith(`/api/export/${RESULT.id}/download/`)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the pending state with aria-busy while exporting', () => {
    stubExport(undefined, true)
    renderModal(freshClient())
    const confirm = screen.getByRole('button', { name: 'common.credits.exporting' })
    expect(confirm).toHaveAttribute('aria-busy', 'true')
  })
})

describe('ExportModal — free tier states (4.4 D8: no POST until 4.6)', () => {
  beforeEach(() => {
    stubPreview(FREE_PREVIEW)
  })

  it('states the 5-row cap and shows the watermark rows as literal content', () => {
    renderModal(freshClient(), { tier: 'free' })
    expect(screen.getByText('export.modal.title_free')).toBeInTheDocument()
    expect(screen.getByText('export.modal.rows_capped')).toBeInTheDocument()
    const previewBox = screen.getByLabelText('export.modal.preview_label')
    const watermark = within(previewBox).getAllByText('export.watermark')
    expect(watermark).toHaveLength(2)
  })

  it('disables the xlsx button visibly (aria-disabled, focusable) with the upgrade caption', () => {
    renderModal(freshClient(), { tier: 'free' })
    const xlsx = screen.getByRole('button', { name: /Excel/ })
    expect(xlsx).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('export.modal.xlsx_upgrade')).toBeInTheDocument()
  })

  it('routes the xlsx click to the upgrade stub toast, never a mutation', () => {
    renderModal(freshClient(), { tier: 'free' })
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }))
    expect(toastMock).toHaveBeenCalledWith('billing.upgrade_stub')
    expect(exportService.create).not.toHaveBeenCalled()
  })

  it('routes the free-tier confirm to the upgrade stub toast and NEVER posts', () => {
    renderModal(freshClient(), { tier: 'free' })
    fireEvent.click(screen.getByText('export.modal.confirm'))
    expect(toastMock).toHaveBeenCalledWith('billing.upgrade_stub')
    expect(exportService.create).not.toHaveBeenCalled()
  })
})

describe('ExportModal — error states map to the modal own localized copy', () => {
  it('replaces the form with the come-back-tomorrow state on 429 (limit)', () => {
    stubExport('limit')
    renderModal(freshClient())
    const state = screen.getByText('export.modal.come_back_tomorrow')
    expect(state).toBeInTheDocument()
    expect(screen.queryByText('export.modal.confirm')).not.toBeInTheDocument()
    expect(state).toHaveAttribute('role', 'status')
  })

  it('moves focus into the swapped region when the error state changes', async () => {
    const { rerender } = renderModal(freshClient())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('checkbox')))

    stubExport('credits')
    rerender(
      <QueryClientProvider client={freshClient()}>
        <ExportModal
          open
          onOpenChange={vi.fn()}
          tab="people"
          filtersJson="{}"
          sort="name:asc"
          nonce={1}
          total={3}
          tier="starter"
          balance={15}
        />
      </QueryClientProvider>,
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText('export.modal.error_credits')),
    )
  })

  it('replaces the form with the credits error state on 402', () => {
    stubExport('credits')
    renderModal(freshClient())
    expect(screen.getByText('export.modal.error_credits')).toBeInTheDocument()
    expect(screen.queryByText('export.modal.confirm')).not.toBeInTheDocument()
  })

  it('shows the concurrent state on 409 with a retry affordance', () => {
    const create = vi.fn()
    stubExport('concurrent', false, create)
    renderModal(freshClient())
    expect(screen.getByText('export.modal.error_concurrent')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'search.results.retry' }))
    expect(create).toHaveBeenCalledWith({
      record_ids: ['p-1', 'p-2', 'p-3'],
      format: 'csv',
      include_unrevealed: true,
    })
  })

  it('shows the generic state on 404/400/network', () => {
    stubExport('generic')
    renderModal(freshClient())
    expect(screen.getByText('export.modal.error_generic')).toBeInTheDocument()
  })

  it('renders the client-side 0-credit guard: aria-disabled confirm with the insufficient caption', () => {
    stubPreview({ ...PREVIEW, totalRows: 5, unrevealedCount: 4 })
    renderModal(freshClient(), { balance: 3 })
    const confirm = screen.getByText('export.modal.confirm')
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(confirm).toHaveAttribute('aria-describedby', 'export-insufficient-note')
    expect(screen.getByText('export.modal.insufficient')).toBeInTheDocument()
    fireEvent.click(confirm)
    expect(toastMock).toHaveBeenCalledWith('common.credits.no_credits')
    expect(exportService.create).not.toHaveBeenCalled()
  })

  it('renders the confirm honestly disabled when the preview collector failed (no silent dead button)', () => {
    stubPreview(null, { error: new Error('preview boom') })
    renderModal(freshClient())
    const confirm = screen.getByText('export.modal.confirm')
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('export.modal.preview_error')).toBeInTheDocument()
    fireEvent.click(confirm)
    expect(exportService.create).not.toHaveBeenCalled()
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('keeps the confirm inert while the balance is unknown (no false no-credits toast)', () => {
    renderModal(freshClient(), { balance: null })
    const confirm = screen.getByText('export.modal.confirm')
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(confirm)
    expect(toastMock).not.toHaveBeenCalled()
    expect(exportService.create).not.toHaveBeenCalled()
  })

  it('blocks the confirm when include_unrevealed is off and nothing is revealed (no empty POST)', () => {
    const allUnrevealed: ExportPreview = {
      ids: ['p-1', 'p-2', 'p-3'],
      rows: PREVIEW.rows.map((row) => ({ ...row, revealed: false })),
      revealedCount: 0,
      unrevealedCount: 3,
      totalRows: 3,
    }
    stubPreview(allUnrevealed)
    renderModal(freshClient())
    fireEvent.click(screen.getByRole('checkbox'))
    const confirm = screen.getByText('export.modal.confirm')
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(confirm)
    expect(exportService.create).not.toHaveBeenCalled()
  })

  it('omits the fabricated ellipsis when the set has at most two rows', () => {
    stubPreview({ ...PREVIEW, totalRows: 2, unrevealedCount: 1 })
    renderModal(freshClient())
    const previewBox = screen.getByLabelText('export.modal.preview_label')
    expect(within(previewBox).queryByText('…')).not.toBeInTheDocument()
  })

  it('resets the form defaults and the mutation error on every open', () => {
    const reset = vi.fn()
    vi.mocked(useExport).mockReturnValue({ create: vi.fn(), isPending: false, error: undefined, reset })
    const { rerender } = renderModal(freshClient())
    expect(reset).toHaveBeenCalled()
    rerender(
      <QueryClientProvider client={freshClient()}>
        <ExportModal
          open={false}
          onOpenChange={vi.fn()}
          tab="people"
          filtersJson="{}"
          sort="name:asc"
          nonce={1}
          total={3}
          tier="starter"
          balance={15}
        />
      </QueryClientProvider>,
    )
    expect(reset).toHaveBeenCalledTimes(1)
    rerender(
      <QueryClientProvider client={freshClient()}>
        <ExportModal
          open
          onOpenChange={vi.fn()}
          tab="people"
          filtersJson="{}"
          sort="name:asc"
          nonce={1}
          total={3}
          tier="starter"
          balance={15}
        />
      </QueryClientProvider>,
    )
    expect(reset).toHaveBeenCalledTimes(2)
  })
})

describe('ExportModal — accessibility', () => {
  it('moves initial focus to the first focusable element inside the dialog', async () => {
    renderModal(freshClient())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('checkbox')))
  })

  it('closes on Esc', () => {
    const { onOpenChange } = renderModal(freshClient())
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes via the dialog close affordance', () => {
    const { onOpenChange } = renderModal(freshClient())
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Close' })
    fireEvent.click(close)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
