import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChecklistCard } from '@/components/search/ChecklistCard'
import { checklistService, type ChecklistState } from '@/lib/api/checklist-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'

type SessionShape = {
  isAuthenticated: boolean
  status: 'loading' | 'authenticated' | 'guest'
  user: {
    email: string
    locale: string
    tier: string
    credits_balance: number
    email_verified_at: string | null
  } | null
  refresh: () => void
  logout: () => void
}

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn<() => SessionShape>(() => ({
    isAuthenticated: false,
    status: 'guest',
    user: null,
    refresh: vi.fn(),
    logout: vi.fn(),
  })),
}))

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: useSessionMock,
}))

vi.mock('@/lib/api/checklist-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/checklist-service')>()
  return {
    ...actual,
    checklistService: {
      get: vi.fn(),
      dismiss: vi.fn(),
    },
  }
})

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: null,
}

const FRESH: ChecklistState = {
  step_search: false,
  step_reveal: false,
  step_export: false,
  dismissed: false,
}

function renderCard(state: ChecklistState | null = FRESH, onStepComplete = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  useSessionMock.mockReturnValue({
    isAuthenticated: true,
    status: 'authenticated',
    user: USER,
    refresh: vi.fn(),
    logout: vi.fn(),
  })
  if (state !== null) {
    vi.mocked(checklistService.get).mockResolvedValue(state)
  }
  const utils = render(
    <QueryClientProvider client={client}>
      <ChecklistCard onStepComplete={onStepComplete} />
    </QueryClientProvider>,
  )
  return { onStepComplete, client, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChecklistCard render gating', () => {
  it('renders nothing while the checklist state loads (no flash)', () => {
    vi.mocked(checklistService.get).mockReturnValue(new Promise(() => {}))
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: USER,
      refresh: vi.fn(),
      logout: vi.fn(),
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ChecklistCard />
      </QueryClientProvider>,
    )
    expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument()
  })

  it('renders nothing for guests', async () => {
    vi.mocked(checklistService.get).mockResolvedValue(FRESH)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    useSessionMock.mockReturnValue({
      isAuthenticated: false,
      status: 'guest',
      user: null,
      refresh: vi.fn(),
      logout: vi.fn(),
    })
    render(
      <QueryClientProvider client={client}>
        <ChecklistCard />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(checklistService.get).not.toHaveBeenCalled())
    expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument()
  })

  it('renders nothing when the checklist is dismissed', async () => {
    renderCard({ ...FRESH, dismissed: true })
    await waitFor(() => expect(checklistService.get).toHaveBeenCalled())
    expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument()
  })

  it('renders nothing when all three steps are complete', async () => {
    renderCard({ step_search: true, step_reveal: true, step_export: true, dismissed: false })
    await waitFor(() => expect(checklistService.get).toHaveBeenCalled())
    expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument()
  })

  it('renders nothing when dismissed mid-way (1 of 3 complete)', async () => {
    renderCard({ step_search: true, step_reveal: false, step_export: false, dismissed: true })
    await waitFor(() => expect(checklistService.get).toHaveBeenCalled())
    expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument()
  })
})

describe('ChecklistCard anatomy', () => {
  it('renders the card shell with the AC tokens', async () => {
    renderCard()
    const card = await screen.findByTestId('checklist-card')
    expect(card.className).toContain('rounded-lg')
    expect(card.className).toContain('border-border')
    expect(card.className).toContain('bg-card')
    expect(screen.getByText('search.checklist.title')).toBeInTheDocument()
  })

  it('renders the three steps in AC order', async () => {
    renderCard()
    const card = await screen.findByTestId('checklist-card')
    const lis = Array.from(card.querySelectorAll('ul li'))
    const labels = lis.map((li) => {
      const label = Array.from(li.querySelectorAll('span')).find(
        (span) => !span.className.includes('sr-only'),
      )
      return label?.textContent
    })
    expect(labels).toEqual([
      'search.checklist.step_search',
      'search.checklist.step_reveal',
      'search.checklist.step_export',
    ])
  })

  it('styles pending steps with the border icon and foreground label', async () => {
    renderCard()
    await screen.findByTestId('checklist-card')
    const searchRow = screen.getByText('search.checklist.step_search').closest('li')
    expect(searchRow).not.toBeNull()
    expect(searchRow?.querySelector('svg')?.getAttribute('class')).toContain('text-border')
    expect(screen.getByText('search.checklist.step_search').className).toContain(
      'text-foreground',
    )
  })

  it('styles complete steps with the success check and muted-foreground label', async () => {
    renderCard({ ...FRESH, step_search: true })
    await screen.findByTestId('checklist-card')
    const searchRow = screen.getByText('search.checklist.step_search').closest('li')
    expect(searchRow?.querySelector('svg')?.getAttribute('class')).toContain('text-success')
    expect(screen.getByText('search.checklist.step_search').className).toContain(
      'text-muted-foreground',
    )
  })

  it('never applies strikethrough to a complete label', async () => {
    renderCard({ step_search: true, step_reveal: true, step_export: true, dismissed: false })
    await waitFor(() => expect(checklistService.get).toHaveBeenCalled())
    expect(document.body.textContent ?? '').not.toContain('line-through')
  })

  it('renders sr-only state per row and hides icons from the a11y tree', async () => {
    renderCard({ ...FRESH, step_search: true })
    await screen.findByTestId('checklist-card')
    expect(screen.getAllByText('search.checklist.pending')).toHaveLength(2)
    expect(screen.getByText('search.checklist.complete')).toBeInTheDocument()
    const icons = document.querySelectorAll('[data-testid="checklist-card"] svg')
    for (const icon of Array.from(icons)) {
      expect(icon.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('uses no physical layout classes in its own markup (RTL smoke)', async () => {
    renderCard()
    const card = await screen.findByTestId('checklist-card')
    const own = Array.from(card.querySelectorAll('*')).filter(
      (el) => el.getAttribute('data-slot') !== 'button',
    )
    const classes = own
      .flatMap((el) => Array.from(el.classList))
      .filter((name) => typeof name === 'string')
    expect(classes).not.toContain('ml-4')
    expect(classes.join(' ')).not.toMatch(/ml-|mr-|pl-|pr-|left-|right-/)
  })
})

describe('ChecklistCard live check-off', () => {
  it('fires onStepComplete when a step flips mid-session', async () => {
    vi.mocked(checklistService.get)
      .mockResolvedValueOnce(FRESH)
      .mockResolvedValueOnce({ ...FRESH, step_search: true })
    const onStepComplete = vi.fn()
    const { client } = renderCard(null, onStepComplete)
    await screen.findByTestId('checklist-card')
    client.invalidateQueries({ queryKey: checklistKeys.all })
    await waitFor(() => expect(onStepComplete).toHaveBeenCalledWith('search'))
  })

  it('fires onStepComplete once per flipped step', async () => {
    vi.mocked(checklistService.get)
      .mockResolvedValueOnce(FRESH)
      .mockResolvedValueOnce({ ...FRESH, step_search: true, step_reveal: true })
    const onStepComplete = vi.fn()
    const { client } = renderCard(null, onStepComplete)
    await screen.findByTestId('checklist-card')
    client.invalidateQueries({ queryKey: checklistKeys.all })
    await waitFor(() => expect(onStepComplete).toHaveBeenCalledTimes(2))
    expect(onStepComplete).toHaveBeenCalledWith('search')
    expect(onStepComplete).toHaveBeenCalledWith('reveal')
  })

  it('never announces steps already complete on mount (returning user)', async () => {
    const onStepComplete = vi.fn()
    renderCard({ step_search: true, step_reveal: false, step_export: false, dismissed: false }, onStepComplete)
    await screen.findByTestId('checklist-card')
    await waitFor(() => expect(checklistService.get).toHaveBeenCalled())
    expect(onStepComplete).not.toHaveBeenCalled()
  })

  it('does not re-fire for steps already tracked', async () => {
    vi.mocked(checklistService.get)
      .mockResolvedValueOnce({ ...FRESH, step_search: true })
      .mockResolvedValueOnce({ ...FRESH, step_search: true })
    const onStepComplete = vi.fn()
    const { client } = renderCard(null, onStepComplete)
    await screen.findByTestId('checklist-card')
    client.invalidateQueries({ queryKey: checklistKeys.all })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onStepComplete).not.toHaveBeenCalled()
  })
})

describe('ChecklistCard dismissal', () => {
  it('dismisses on X click and unmounts after the refetch lands', async () => {
    vi.mocked(checklistService.dismiss).mockResolvedValue({ ...FRESH, dismissed: true })
    vi.mocked(checklistService.get)
      .mockResolvedValueOnce(FRESH)
      .mockResolvedValueOnce({ ...FRESH, dismissed: true })
    renderCard()
    const dismissButton = await screen.findByLabelText('search.checklist.dismiss')
    await userEvent.click(dismissButton)
    await waitFor(() => expect(checklistService.dismiss).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument(),
    )
  })

  it('exposes a keyboard-reachable dismiss button with the touch target', async () => {
    renderCard()
    const dismissButton = await screen.findByLabelText('search.checklist.dismiss')
    expect(dismissButton.tagName).toBe('BUTTON')
    dismissButton.focus()
    expect(dismissButton).toHaveFocus()
    expect(dismissButton.className).toContain('min-h-11')
  })

  it('disables the X while the dismiss mutation is pending', async () => {
    vi.mocked(checklistService.dismiss).mockReturnValue(new Promise(() => {}))
    renderCard()
    const dismissButton = await screen.findByLabelText('search.checklist.dismiss')
    await userEvent.click(dismissButton)
    expect(dismissButton).toBeDisabled()
    await userEvent.click(dismissButton)
    expect(checklistService.dismiss).toHaveBeenCalledTimes(1)
  })
})
