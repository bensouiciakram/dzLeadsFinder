import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { ExportToolbar } from '@/components/search/ExportToolbar'

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
})
