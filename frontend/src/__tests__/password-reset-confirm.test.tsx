import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PasswordResetConfirm } from '@/components/auth/PasswordResetConfirm'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: pushMock, replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const authServiceMock = vi.hoisted(() => ({
  validatePasswordResetToken: vi.fn(),
  confirmPasswordReset: vi.fn(),
}))

vi.mock('@/lib/api/auth-service', () => ({
  authService: authServiceMock,
}))

const NEW_PASSWORD_LABEL = 'auth.password_reset.new_password_label'
const CONFIRM_PASSWORD_LABEL = 'auth.password_reset.confirm_password_label'
const SUBMIT_NEW = 'auth.password_reset.submit_new'
const REQUEST_LINK = 'auth.password_reset.request_new_link'
const TOKEN = 'reset-token-123'

function errorResponse(status: number, code: string) {
  return {
    status,
    statusText: 'Error',
    headers: {},
    data: { detail: 'error', code },
    config: { headers: {} },
  } as AxiosResponse
}

function httpError(status: number, code: string) {
  return new AxiosError(
    'Request failed',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    errorResponse(status, code),
  )
}

describe('PasswordResetConfirm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    authServiceMock.validatePasswordResetToken.mockReset()
    authServiceMock.confirmPasswordReset.mockReset()
  })

  it('shows the new-password form with requirement note when the token is valid', async () => {
    authServiceMock.validatePasswordResetToken.mockResolvedValue({ code: 'token_valid' })
    render(<PasswordResetConfirm token={TOKEN} />)
    expect(await screen.findByLabelText(NEW_PASSWORD_LABEL)).toBeInTheDocument()
    expect(screen.getByLabelText(CONFIRM_PASSWORD_LABEL)).toBeInTheDocument()
    expect(screen.getByText('auth.password_reset.password_requirements')).toBeInTheDocument()
    expect(authServiceMock.validatePasswordResetToken).toHaveBeenCalledWith(TOKEN)
  })

  it('shows short-password and mismatch errors with aria attributes', async () => {
    authServiceMock.validatePasswordResetToken.mockResolvedValue({ code: 'token_valid' })
    render(<PasswordResetConfirm token={TOKEN} />)
    await screen.findByLabelText(NEW_PASSWORD_LABEL)
    fireEvent.click(screen.getByText(SUBMIT_NEW))
    const newPassword = screen.getByLabelText(NEW_PASSWORD_LABEL)
    const confirmPassword = screen.getByLabelText(CONFIRM_PASSWORD_LABEL)
    await waitFor(() => expect(newPassword).toHaveAttribute('aria-invalid', 'true'))
    expect(newPassword).toHaveAttribute('aria-describedby', 'reset-new-password-error')
    expect(confirmPassword).toHaveAttribute('aria-describedby', 'reset-confirm-password-error')

    fireEvent.change(newPassword, { target: { value: 'short' } })
    fireEvent.change(confirmPassword, { target: { value: 'short' } })
    fireEvent.click(screen.getByText(SUBMIT_NEW))
    await waitFor(() =>
      expect(screen.getByText('common.errors.invalid_password')).toBeInTheDocument(),
    )

    fireEvent.change(newPassword, { target: { value: 'SecurePass123!' } })
    fireEvent.change(confirmPassword, { target: { value: 'DifferentPass123!' } })
    fireEvent.click(screen.getByText(SUBMIT_NEW))
    await waitFor(() =>
      expect(screen.getByText('common.errors.password_mismatch')).toBeInTheDocument(),
    )
  })

  it('calls confirmPasswordReset and shows success with a login CTA', async () => {
    authServiceMock.validatePasswordResetToken.mockResolvedValue({ code: 'token_valid' })
    authServiceMock.confirmPasswordReset.mockResolvedValue(undefined)
    render(<PasswordResetConfirm token={TOKEN} />)
    const newPassword = await screen.findByLabelText(NEW_PASSWORD_LABEL)
    fireEvent.change(newPassword, { target: { value: 'SecurePass123!' } })
    fireEvent.change(screen.getByLabelText(CONFIRM_PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT_NEW))
    await waitFor(() => {
      expect(authServiceMock.confirmPasswordReset).toHaveBeenCalledWith(TOKEN, 'SecurePass123!')
    })
    expect(await screen.findByText('auth.password_reset.reset_done')).toBeInTheDocument()
    fireEvent.click(screen.getByText('auth.password_reset.go_to_login'))
    expect(pushMock).toHaveBeenCalledWith('/login?reason=password_reset')
  })

  it('shows the expired screen with a request-new-link on 400', async () => {
    authServiceMock.validatePasswordResetToken.mockRejectedValue(httpError(400, 'token_expired'))
    render(<PasswordResetConfirm token={TOKEN} />)
    expect(await screen.findByText('auth.password_reset.expired_title')).toBeInTheDocument()
    expect(screen.getByText(REQUEST_LINK)).toHaveAttribute('href', '/password-reset')
    expect(screen.queryByLabelText(NEW_PASSWORD_LABEL)).not.toBeInTheDocument()
  })

  it('shows the expired-or-invalid screen on 404', async () => {
    authServiceMock.validatePasswordResetToken.mockRejectedValue(httpError(404, 'token_not_found'))
    render(<PasswordResetConfirm token={TOKEN} />)
    expect(await screen.findByText('auth.password_reset.expired_title')).toBeInTheDocument()
  })

  it('shows the used screen on 410', async () => {
    authServiceMock.validatePasswordResetToken.mockRejectedValue(httpError(410, 'token_used'))
    render(<PasswordResetConfirm token={TOKEN} />)
    expect(await screen.findByText('auth.password_reset.used_title')).toBeInTheDocument()
    expect(screen.getByText('auth.password_reset.used_description')).toBeInTheDocument()
    expect(screen.queryByLabelText(NEW_PASSWORD_LABEL)).not.toBeInTheDocument()
  })

  it('shows the generic error state on network failure', async () => {
    authServiceMock.validatePasswordResetToken.mockRejectedValue(new Error('offline'))
    render(<PasswordResetConfirm token={TOKEN} />)
    expect(await screen.findByText('common.states.error')).toBeInTheDocument()
  })

  it('flips to the used screen when the POST replays a consumed link', async () => {
    authServiceMock.validatePasswordResetToken.mockResolvedValue({ code: 'token_valid' })
    authServiceMock.confirmPasswordReset.mockRejectedValue(httpError(410, 'token_used'))
    render(<PasswordResetConfirm token={TOKEN} />)
    const newPassword = await screen.findByLabelText(NEW_PASSWORD_LABEL)
    fireEvent.change(newPassword, { target: { value: 'SecurePass123!' } })
    fireEvent.change(screen.getByLabelText(CONFIRM_PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT_NEW))
    expect(await screen.findByText('auth.password_reset.used_title')).toBeInTheDocument()
  })

  it('keeps the form and shows a root error when the POST is rejected with 400', async () => {
    authServiceMock.validatePasswordResetToken.mockResolvedValue({ code: 'token_valid' })
    authServiceMock.confirmPasswordReset.mockRejectedValue(httpError(400, 'password'))
    render(<PasswordResetConfirm token={TOKEN} />)
    const newPassword = await screen.findByLabelText(NEW_PASSWORD_LABEL)
    fireEvent.change(newPassword, { target: { value: 'SecurePass123!' } })
    fireEvent.change(screen.getByLabelText(CONFIRM_PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT_NEW))
    expect(await screen.findByText('common.states.error')).toBeInTheDocument()
    expect(screen.getByLabelText(NEW_PASSWORD_LABEL)).toBeInTheDocument()
    expect(screen.queryByText('auth.password_reset.expired_title')).not.toBeInTheDocument()
  })
})
