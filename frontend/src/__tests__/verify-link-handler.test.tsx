import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VerifyLinkHandler } from '@/components/auth/VerifyLinkHandler'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

const authServiceMock = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  refresh: vi.fn(),
  signup: vi.fn(),
  resendVerification: vi.fn(),
  verifyEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  validatePasswordResetToken: vi.fn(),
  confirmPasswordReset: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: pushMock }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/api/auth-service', () => ({
  authService: authServiceMock,
}))

function axiosError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed with status code ' + status, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data,
    headers: {},
    config: { headers: {} },
  } as AxiosResponse)
}

const EMAIL_LABEL = 'auth.verify.email_label'
const RESEND = 'auth.verify.resend'

describe('VerifyLinkHandler', () => {
  beforeEach(() => {
    authServiceMock.verifyEmail.mockReset()
    authServiceMock.resendVerification.mockReset()
    pushMock.mockClear()
  })

  it('shows welcome banner and start-search CTA on verified', async () => {
    authServiceMock.verifyEmail.mockResolvedValue({ code: 'verified' })
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.welcome_title')).toBeInTheDocument()
    expect(screen.getByText('auth.verify.welcome_description')).toBeInTheDocument()
    fireEvent.click(screen.getByText('auth.verify.start_search'))
    expect(pushMock).toHaveBeenCalledWith('/search')
  })

  it('shows already-verified message when code is already_verified', async () => {
    authServiceMock.verifyEmail.mockResolvedValue({ code: 'already_verified' })
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.already_verified')).toBeInTheDocument()
    expect(screen.queryByText('auth.verify.welcome_title')).not.toBeInTheDocument()
  })

  it('shows expired screen with resend form on 400', async () => {
    authServiceMock.verifyEmail.mockRejectedValue(axiosError(400, { code: 'token_expired' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.expired_title')).toBeInTheDocument()
    expect(screen.getByLabelText(EMAIL_LABEL)).toBeInTheDocument()
    authServiceMock.resendVerification.mockResolvedValue(undefined)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'me@example.com' },
    })
    fireEvent.click(screen.getByText(RESEND))
    expect(await screen.findByText('auth.verify.resend_success')).toBeInTheDocument()
  })

  it('validates the resend email on the expired screen', async () => {
    authServiceMock.verifyEmail.mockRejectedValue(axiosError(400, { code: 'token_expired' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.expired_title')).toBeInTheDocument()
    fireEvent.click(screen.getByText(RESEND))
    expect((await screen.findAllByText('common.errors.required')).length).toBeGreaterThanOrEqual(2)
    expect(authServiceMock.resendVerification).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'bad' },
    })
    fireEvent.click(screen.getByText(RESEND))
    expect((await screen.findAllByText('common.errors.invalid_email')).length).toBeGreaterThanOrEqual(2)
    expect(authServiceMock.resendVerification).not.toHaveBeenCalled()
  })

  it('shows a form-level error summary on the expired resend form', async () => {
    authServiceMock.verifyEmail.mockRejectedValue(axiosError(400, { code: 'token_expired' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.expired_title')).toBeInTheDocument()
    fireEvent.click(screen.getByText(RESEND))
    expect(await screen.findByText('common.errors.summary_title')).toBeInTheDocument()
    const anchor = screen.getAllByText('common.errors.required').find((el) => el.tagName === 'A')!
    expect(anchor).toHaveAttribute('href', '#expired-email-error')
    const summary = screen.getByText('common.errors.summary_title').parentElement
    expect(summary).toHaveAttribute('aria-live', 'polite')
  })

  it('shows expired screen on 404', async () => {
    authServiceMock.verifyEmail.mockRejectedValue(axiosError(404, { code: 'token_not_found' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.expired_title')).toBeInTheDocument()
  })

  it('shows used screen with sign-in link on 410', async () => {
    authServiceMock.verifyEmail.mockRejectedValue(axiosError(410, { code: 'token_used' }))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('auth.verify.used_title')).toBeInTheDocument()
    expect(screen.getByText('auth.verify.used_description')).toBeInTheDocument()
    expect(screen.getByText('common.nav.login')).toHaveAttribute('href', '/login')
    expect(screen.queryByText('auth.verify.welcome_title')).not.toBeInTheDocument()
  })

  it('shows generic error on network failure', async () => {
    authServiceMock.verifyEmail.mockRejectedValue(new Error('offline'))
    render(<VerifyLinkHandler token="abc" />)
    expect(await screen.findByText('common.states.error')).toBeInTheDocument()
  })

  it('calls the verify endpoint with the token', async () => {
    authServiceMock.verifyEmail.mockResolvedValue({ code: 'verified' })
    render(<VerifyLinkHandler token="tok-123" />)
    await waitFor(() => {
      expect(authServiceMock.verifyEmail).toHaveBeenCalledWith('tok-123')
    })
  })
})