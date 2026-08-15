import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VerifyEmailGate } from '@/components/auth/VerifyEmailGate'

const useSearchParamsSpy = vi.hoisted(() => vi.fn(() => new URLSearchParams()))

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
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: useSearchParamsSpy,
}))

vi.mock('@/lib/api/auth-service', () => ({
  authService: authServiceMock,
}))

const EMAIL_LABEL = 'auth.verify.email_label'
const RESEND = 'auth.verify.resend'

describe('VerifyEmailGate', () => {
  beforeEach(() => {
    authServiceMock.resendVerification.mockReset()
    useSearchParamsSpy.mockReset()
    useSearchParamsSpy.mockImplementation(() => new URLSearchParams())
  })

  it('renders gate message, expiry note and resend button', () => {
    render(<VerifyEmailGate />)
    expect(screen.getByText('auth.verify.gate_title')).toBeInTheDocument()
    expect(screen.getByText('auth.verify.gate_description')).toBeInTheDocument()
    expect(screen.getByText('auth.verify.expiry_note')).toBeInTheDocument()
    expect(screen.getByText(RESEND)).toBeInTheDocument()
  })

  it('prefills email from the email query param', () => {
    useSearchParamsSpy.mockReturnValue(new URLSearchParams('email=me@example.com'))
    render(<VerifyEmailGate />)
    expect(screen.getByLabelText(EMAIL_LABEL)).toHaveValue('me@example.com')
  })

  it('shows required error when resending with an empty email', async () => {
    render(<VerifyEmailGate />)
    fireEvent.click(screen.getByText(RESEND))
    await waitFor(() =>
      expect(screen.getByLabelText(EMAIL_LABEL)).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(screen.getAllByText('common.errors.required').length).toBeGreaterThanOrEqual(2)
    expect(authServiceMock.resendVerification).not.toHaveBeenCalled()
  })

  it('shows invalid email error for a malformed email', async () => {
    render(<VerifyEmailGate />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'not-an-email' },
    })
    fireEvent.click(screen.getByText(RESEND))
    expect(
      (await screen.findAllByText('common.errors.invalid_email')).length,
    ).toBeGreaterThanOrEqual(2)
    expect(authServiceMock.resendVerification).not.toHaveBeenCalled()
  })

  it('renders the resend control as a submit button with the localized link text', () => {
    render(<VerifyEmailGate />)
    const resend = screen.getByText(RESEND)
    expect(resend.tagName).toBe('BUTTON')
    expect(resend).toHaveAttribute('type', 'submit')
  })

  it('shows a form-level error summary with aria-live and a jump link on invalid submit', async () => {
    render(<VerifyEmailGate />)
    fireEvent.click(screen.getByText(RESEND))
    await waitFor(() => expect(screen.getByText('common.errors.summary_title')).toBeInTheDocument())
    const anchor = screen.getAllByText('common.errors.required').find((el) => el.tagName === 'A')!
    expect(anchor).toHaveAttribute('href', '#verify-email-error')
    const summary = screen.getByText('common.errors.summary_title').parentElement
    expect(summary).toHaveAttribute('aria-live', 'polite')
  })

  it('hard gate: the pre-verification gate exposes no navigation to app surfaces', () => {
    const { container } = render(<VerifyEmailGate />)
    expect(container.querySelectorAll('a').length).toBe(0)
    expect(screen.getByText(RESEND)).toBeInTheDocument()
  })

  it('shows the click-the-link instruction when the email param is present', () => {
    useSearchParamsSpy.mockReturnValue(new URLSearchParams('email=me@example.com'))
    render(<VerifyEmailGate />)
    expect(screen.getByText('auth.verify.description')).toBeInTheDocument()
  })

  it('omits the click-the-link instruction when no email param is present', () => {
    render(<VerifyEmailGate />)
    expect(screen.queryByText('auth.verify.description')).not.toBeInTheDocument()
  })

  it('shows success message after resend succeeds', async () => {
    authServiceMock.resendVerification.mockResolvedValue(undefined)
    render(<VerifyEmailGate />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'me@example.com' },
    })
    fireEvent.click(screen.getByText(RESEND))
    expect(await screen.findByText('auth.verify.resend_success')).toBeInTheDocument()
  })

  it('shows error message when resend fails', async () => {
    authServiceMock.resendVerification.mockRejectedValue(new Error('oops'))
    render(<VerifyEmailGate />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'me@example.com' },
    })
    fireEvent.click(screen.getByText(RESEND))
    expect(await screen.findByText('auth.verify.resend_failed')).toBeInTheDocument()
  })
})