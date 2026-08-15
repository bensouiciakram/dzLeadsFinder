import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { ExportToolbar } from '@/components/search/ExportToolbar'
import { useExport } from '@/hooks/useExport'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/providers/ToastProvider', () => ({
  useToast: () => ({ toast: toastMock }),
}))

const upgradeOpenMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/providers/UpgradeDialogProvider', () => ({
  useUpgradeDialog: () => ({
    open: upgradeOpenMock,
    close: vi.fn(),
    isOpen: false,
  }),
}))

const creditsMock = vi.hoisted(() => ({
  balance: 15,
  applyCreditDelta: vi.fn(),
  applyConfirmedBalance: vi.fn(),
}))
vi.mock('@/components/providers/CreditProvider', () => ({
  useCredits: () => creditsMock,
}))

vi.mock('@/hooks/useExportPreview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useExportPreview')>()
  return {
    ...actual,
    useExportPreview: vi.fn(() => ({
      preview: null,
      isCollecting: false,
      error: null,
      retry: vi.fn(),
    })),
  }
})

vi.mock('@/hooks/useExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useExport')>()
  return {
    ...actual,
    useExport: vi.fn(() => ({
      create: vi.fn(),
      isPending: false,
      error: undefined,
      reset: vi.fn(),
    })),
  }
})

const SUBMITTED = {
  filters: {
    industries: [],
    wilayas: [],
    seniorities: [],
    sizes: [],
    includeUnknownSize: false,
    keyword: '',
  },
  filtersJson: '{}',
  page: 1,
  sort: 'name:asc',
}

function renderToolbar(overrides: Partial<Parameters<typeof ExportToolbar>[0]> = {}) {
  return render(
    <ExportToolbar
      tab="people"
      submitted={SUBMITTED}
      nonce={1}
      total={42}
      isFetching={false}
      tier="starter"
      {...overrides}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExportToolbar', () => {
  it('renders the Export trigger when results exist', () => {
    renderToolbar()
    expect(screen.getByRole('button', { name: 'common.actions.export' })).toBeInTheDocument()
  })

  it('renders nothing before a search is submitted', () => {
    renderToolbar({ submitted: null })
    expect(screen.queryByRole('button', { name: 'common.actions.export' })).not.toBeInTheDocument()
  })

  it('renders nothing for an empty result set', () => {
    renderToolbar({ total: 0 })
    expect(screen.queryByRole('button', { name: 'common.actions.export' })).not.toBeInTheDocument()
  })

  it('renders for the free tier (the upgrade funnel is never hidden)', () => {
    renderToolbar({ tier: 'free' })
    expect(screen.getByRole('button', { name: 'common.actions.export' })).toBeInTheDocument()
  })

  it('renders for the companies tab', () => {
    renderToolbar({ tab: 'companies' })
    expect(screen.getByRole('button', { name: 'common.actions.export' })).toBeInTheDocument()
  })

  it('is aria-disabled and does not open while the results query is fetching', () => {
    renderToolbar({ isFetching: true })
    const trigger = screen.getByRole('button', { name: 'common.actions.export' })
    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(trigger)
    expect(screen.queryByText('export.modal.title')).not.toBeInTheDocument()
  })

  it('opens the export modal on click', async () => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'common.actions.export' }))
    expect(await screen.findByText('export.modal.title')).toBeInTheDocument()
  })

  it('remounts the modal fresh on every open (M12 open-session key)', async () => {
    const create = vi.fn()
    vi.mocked(useExport).mockReturnValue({
      create,
      isPending: false,
      error: undefined,
      reset: vi.fn(),
    })
    const { unmount } = renderToolbar()
    const trigger = screen.getByRole('button', { name: 'common.actions.export' })
    fireEvent.click(trigger)
    expect(await screen.findByText('export.modal.title')).toBeInTheDocument()
    // Dirty the form state inside the open modal.
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    // Close, then reopen — the reopen must mount a FRESH instance with the
    // AC-pinned defaults (the toolbar's keyed remount, not a reset effect).
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('export.modal.title')).not.toBeInTheDocument())
    fireEvent.click(trigger)
    expect(await screen.findByText('export.modal.title')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByRole('button', { name: 'CSV' })).toHaveAttribute('aria-pressed', 'true')
    unmount()
  })
})
