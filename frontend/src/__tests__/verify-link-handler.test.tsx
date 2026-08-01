import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VerifyLinkHandler } from '@/components/auth/VerifyLinkHandler'

const fetchMock = vi.hoisted(() => vi.fn())
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: pushMock }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('VerifyLinkHandler', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    pushMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('shows welcome banner and start-search CTA on verified', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'verified' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('welcome_title')).toBeInTheDocument()
    expect(screen.getByText('welcome_description')).toBeInTheDocument()
    fireEvent.click(screen.getByText('start_search'))
    expect(pushMock).toHaveBeenCalledWith('/search')
  })

  it('shows already-verified message when code is already_verified', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'already_verified' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('already_verified')).toBeInTheDocument()
    expect(screen.queryByText('welcome_title')).not.toBeInTheDocument()
  })

  it('shows expired screen with resend form on 400', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'token_expired' }, 400))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('expired_title')).toBeInTheDocument()
    expect(screen.getByLabelText('email_label')).toBeInTheDocument()
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'ok' }))
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'me@example.com' },
    })
    fireEvent.click(screen.getByText('resend'))
    expect(await screen.findByText('resend_success')).toBeInTheDocument()
  })

  it('shows expired screen on 404', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'token_not_found' }, 404))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('expired_title')).toBeInTheDocument()
  })

  it('shows used screen with sign-in link on 410', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'token_used' }, 410))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('used_title')).toBeInTheDocument()
    expect(screen.getByText('used_description')).toBeInTheDocument()
    expect(screen.getByText('nav.login')).toHaveAttribute('href', '/login')
    expect(screen.queryByText('welcome_title')).not.toBeInTheDocument()
  })

  it('shows generic error on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('states.error')).toBeInTheDocument()
  })

  it('calls the verify endpoint with the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'verified' }))
    render(<VerifyLinkHandler token="tok-123" />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/verify-email/tok-123/')
    })
  })
})
