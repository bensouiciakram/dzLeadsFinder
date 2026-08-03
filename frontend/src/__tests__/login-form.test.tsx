import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginForm } from '@/components/auth/LoginForm'
import { SessionProvider } from '@/components/providers/SessionProvider'

const { pushMock, searchParamsMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsMock: vi.fn(() => new URLSearchParams()),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: pushMock, replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: searchParamsMock,
}))

const authServiceMock = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/lib/api/auth-service', () => ({
  authService: authServiceMock,
}))

const EMAIL_LABEL = 'auth.login.email_label'
const PASSWORD_LABEL = 'auth.login.password_label'
const SUBMIT = 'auth.login.submit'
const USER = {
  email: 'user@example.com',
  locale: 'ar',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: '2026-07-01T10:00:00+00:00',
}

function renderLoginForm() {
  return render(
    <SessionProvider>
      <LoginForm />
    </SessionProvider>,
  )
}

function badRequestResponse(status: number) {
  return {
    status,
    statusText: 'Bad Request',
    headers: {},
    data: { detail: 'No active account found with the given credentials' },
    config: { headers: {} },
  } as AxiosResponse
}

describe('LoginForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    searchParamsMock.mockReset()
    searchParamsMock.mockReturnValue(new URLSearchParams())
    authServiceMock.login.mockReset()
    authServiceMock.logout.mockReset()
    authServiceMock.me.mockReset()
    authServiceMock.refresh.mockReset()
  })

  it('renders email and password fields with forgot and signup links', () => {
    renderLoginForm()
    expect(screen.getByLabelText(EMAIL_LABEL)).toBeInTheDocument()
    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeInTheDocument()
    expect(screen.getByText('auth.login.forgot_password')).toHaveAttribute('href', '/password-reset')
    expect(screen.getByText('auth.login.signup_link')).toHaveAttribute('href', '/signup')
  })

  it('shows required errors with aria attributes on empty submit', async () => {
    renderLoginForm()
    fireEvent.click(screen.getByText(SUBMIT))
    const email = screen.getByLabelText(EMAIL_LABEL)
    const password = screen.getByLabelText(PASSWORD_LABEL)
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    expect(email).toHaveAttribute('aria-describedby', 'login-email-error')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('common.errors.required').length).toBe(4)
  })

  it('shows invalid email error for malformed email', async () => {
    renderLoginForm()
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'not-an-email' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => expect(screen.getByLabelText(EMAIL_LABEL)).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getAllByText('common.errors.invalid_email').length).toBe(2)
  })

  it('shows invalid password error for short password', async () => {
    renderLoginForm()
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() =>
      expect(screen.getByLabelText(PASSWORD_LABEL)).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(screen.getAllByText('common.errors.invalid_password').length).toBe(2)
  })

  it('posts credentials and redirects home on success', async () => {
    authServiceMock.login.mockResolvedValue(undefined)
    authServiceMock.me.mockResolvedValue(USER)
    renderLoginForm()
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => {
      expect(authServiceMock.login).toHaveBeenCalledWith('user@example.com', 'SecurePass123!')
    })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })

  it('shows the invalid credentials error on a 400 response', async () => {
    authServiceMock.login.mockRejectedValue(
      new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', undefined, undefined, badRequestResponse(400)),
    )
    renderLoginForm()
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'WrongPass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect(await screen.findByText('auth.login.error_invalid')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('shows a network error when the request fails without a response', async () => {
    authServiceMock.login.mockRejectedValue(new Error('offline'))
    renderLoginForm()
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect(await screen.findByText('common.errors.network')).toBeInTheDocument()
  })

  it('ignores a second submit while a request is in flight', async () => {
    let resolveLogin: (value: undefined) => void
    authServiceMock.login.mockReturnValue(
      new Promise<undefined>((resolve) => {
        resolveLogin = resolve
      }),
    )
    renderLoginForm()
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => {
      expect(authServiceMock.login).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect(authServiceMock.login).toHaveBeenCalledTimes(1)
    resolveLogin!(undefined)
  })

  it('shows a form-level error summary with aria-live and jump links on invalid submit', async () => {
    renderLoginForm()
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => expect(screen.getByText('common.errors.summary_title')).toBeInTheDocument())
    const emailAnchor = screen.getAllByText('common.errors.required').find((el) => el.tagName === 'A')!
    expect(emailAnchor).toHaveAttribute('href', '#login-email-error')
    const summary = screen.getByText('common.errors.summary_title').parentElement
    expect(summary).toHaveAttribute('aria-live', 'polite')
  })

  it('keeps tab order email, password, forgot link, the CTA, then the signup link', () => {
    const { container } = renderLoginForm()
    const focusables = Array.from(container.querySelectorAll('input, a[href], button'))
    expect(focusables.map((el) => el.id || el.textContent)).toEqual([
      'login-email',
      'login-password',
      'auth.login.forgot_password',
      SUBMIT,
      'auth.login.signup_link',
    ])
  })
})

describe('LoginForm session-expired banner', () => {
  beforeEach(() => {
    searchParamsMock.mockReset()
  })

  it('renders the session expired notice when reason=session_expired', async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('reason=session_expired'))
    renderLoginForm()
    expect(await screen.findByText('auth.login.session_expired')).toBeInTheDocument()
  })

  it('does not render the notice without the reason param', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams())
    renderLoginForm()
    expect(screen.queryByText('auth.login.session_expired')).not.toBeInTheDocument()
  })
})

describe('LoginForm password-reset banner', () => {
  beforeEach(() => {
    searchParamsMock.mockReset()
  })

  it('renders the password-reset success notice when reason=password_reset', async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('reason=password_reset'))
    renderLoginForm()
    expect(await screen.findByText('auth.login.password_reset')).toBeInTheDocument()
  })

  it('does not render the notice without the reason param', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams())
    renderLoginForm()
    expect(screen.queryByText('auth.login.password_reset')).not.toBeInTheDocument()
  })
})
