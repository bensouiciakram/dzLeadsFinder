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

const EMAIL_LABEL = 'auth.verify.email_label'
const RESEND = 'auth.verify.resend'

describe('VerifyLinkHandler', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    pushMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('shows welcome banner and start-search CTA on verified', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'verified' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.welcome_title')).toBeInTheDocument()
    expect(screen.getByText('auth.verify.welcome_description')).toBeInTheDocument()
    fireEvent.click(screen.getByText('auth.verify.start_search'))
    expect(pushMock).toHaveBeenCalledWith('/search')
  })

  it('shows already-verified message when code is already_verified', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'already_verified' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.already_verified')).toBeInTheDocument()
    expect(screen.queryByText('auth.verify.welcome_title')).not.toBeInTheDocument()
  })

  it('shows expired screen with resend form on 400', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'token_expired' }, 400))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.expired_title')).toBeInTheDocument()
    expect(screen.getByLabelText(EMAIL_LABEL)).toBeInTheDocument()
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'ok' }))
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'me@example.com' },
    })
    fireEvent.click(screen.getByText(RESEND))
    expect(await screen.findByText('auth.verify.resend_success')).toBeInTheDocument()
  })

  it('validates the resend email on the expired screen', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'token_expired' }, 400))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.expired_title')).toBeInTheDocument()
    fireEvent.click(screen.getByText(RESEND))
    expect(await screen.findByText('common.errors.required')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'bad' },
    })
    fireEvent.click(screen.getByText(RESEND))
    expect(await screen.findByText('common.errors.invalid_email')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows expired screen on 404', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'token_not_found' }, 404))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.expired_title')).toBeInTheDocument()
  })

  it('shows used screen with sign-in link on 410', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'token_used' }, 410))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.used_title')).toBeInTheDocument()
    expect(screen.getByText('auth.verify.used_description')).toBeInTheDocument()
    expect(screen.getByText('common.nav.login')).toHaveAttribute('href', '/login')
    expect(screen.queryByText('auth.verify.welcome_title')).not.toBeInTheDocument()
  })

  it('shows generic error on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('common.states.error')).toBeInTheDocument()
  })

  it('calls the verify endpoint with the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'verified' }))
    render(<VerifyLinkHandler token="tok-123" />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/verify-email/tok-123/')
    })
  })
})
