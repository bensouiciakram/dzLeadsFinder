import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PasswordResetForm } from '@/components/auth/PasswordResetForm'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: pushMock, replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const authServiceMock = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}))

vi.mock('@/lib/api/auth-service', () => ({
  authService: authServiceMock,
}))

const EMAIL_LABEL = 'auth.password_reset.email_label'
const SUBMIT = 'auth.password_reset.submit'

describe('PasswordResetForm', () => {
  beforeEach(() => {
    authServiceMock.requestPasswordReset.mockReset()
  })

  it('renders a single email field and the send-reset-link button', () => {
    render(<PasswordResetForm />)
    expect(screen.getByLabelText(EMAIL_LABEL)).toBeInTheDocument()
    expect(screen.getByText(SUBMIT)).toBeInTheDocument()
    expect(screen.queryByLabelText('auth.password_reset.new_password_label')).not.toBeInTheDocument()
  })

  it('shows required and invalid email errors with aria attributes', async () => {
    render(<PasswordResetForm />)
    fireEvent.click(screen.getByText(SUBMIT))
    const email = screen.getByLabelText(EMAIL_LABEL)
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    expect(email).toHaveAttribute('aria-describedby', 'reset-email-error')
    expect(screen.getAllByText('common.errors.required').length).toBe(2)

    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() =>
      expect(screen.getAllByText('common.errors.invalid_email').length).toBe(2),
    )
  })

  it('shows a form-level error summary with aria-live and a jump link on invalid submit', async () => {
    render(<PasswordResetForm />)
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => expect(screen.getByText('common.errors.summary_title')).toBeInTheDocument())
    const anchor = screen.getAllByText('common.errors.required').find((el) => el.tagName === 'A')!
    expect(anchor).toHaveAttribute('href', '#reset-email-error')
    const summary = screen.getByText('common.errors.summary_title').parentElement
    expect(summary).toHaveAttribute('aria-live', 'polite')
  })

  it('calls requestPasswordReset with the email on submit', async () => {
    authServiceMock.requestPasswordReset.mockResolvedValue(undefined)
    render(<PasswordResetForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => {
      expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith('user@example.com')
    })
  })

  it('shows the anti-enumeration confirmation with a login link on success', async () => {
    authServiceMock.requestPasswordReset.mockResolvedValue(undefined)
    render(<PasswordResetForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect(await screen.findByText('auth.password_reset.sent_confirmation')).toBeInTheDocument()
    expect(screen.getByText('common.nav.login')).toHaveAttribute('href', '/login')
    expect(screen.queryByLabelText(EMAIL_LABEL)).not.toBeInTheDocument()
  })

  it('shows a network error when the request fails without a response', async () => {
    authServiceMock.requestPasswordReset.mockRejectedValue(new Error('offline'))
    render(<PasswordResetForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect(await screen.findByText('common.errors.network')).toBeInTheDocument()
  })

  it('ignores a second submit while a request is in flight', async () => {
    let resolveRequest: (value: undefined) => void
    authServiceMock.requestPasswordReset.mockReturnValue(
      new Promise<undefined>((resolve) => {
        resolveRequest = resolve
      }),
    )
    render(<PasswordResetForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => {
      expect(authServiceMock.requestPasswordReset).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect(authServiceMock.requestPasswordReset).toHaveBeenCalledTimes(1)
    resolveRequest!(undefined)
  })
})
