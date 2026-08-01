import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VerifyEmailGate } from '@/components/auth/VerifyEmailGate'

const fetchMock = vi.hoisted(() => vi.fn())
const useSearchParamsSpy = vi.hoisted(() => vi.fn(() => new URLSearchParams()))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: useSearchParamsSpy,
}))

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('VerifyEmailGate', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    useSearchParamsSpy.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders gate message, expiry note and resend button', () => {
    render(<VerifyEmailGate />)
    expect(screen.getByText('gate_title')).toBeInTheDocument()
    expect(screen.getByText('gate_description')).toBeInTheDocument()
    expect(screen.getByText('expiry_note')).toBeInTheDocument()
    expect(screen.getByText('resend')).toBeInTheDocument()
  })

  it('prefills email from the email query param', () => {
    useSearchParamsSpy.mockReturnValue(new URLSearchParams('email=me@example.com'))
    render(<VerifyEmailGate />)
    expect(screen.getByLabelText('email_label')).toHaveValue('me@example.com')
  })

  it('shows success message after resend succeeds', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'ok' }))
    render(<VerifyEmailGate />)
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'me@example.com' },
    })
    fireEvent.click(screen.getByText('resend'))
    expect(await screen.findByText('resend_success')).toBeInTheDocument()
  })

  it('shows error message when resend fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'oops' }, 500))
    render(<VerifyEmailGate />)
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'me@example.com' },
    })
    fireEvent.click(screen.getByText('resend'))
    expect(await screen.findByText('resend_failed')).toBeInTheDocument()
  })
})
