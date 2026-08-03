import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SignupForm } from '@/components/auth/SignupForm'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
const fetchMock = vi.hoisted(() => vi.fn())

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

const EMAIL_LABEL = 'auth.signup.email_label'
const PASSWORD_LABEL = 'auth.signup.password_label'
const SUBMIT = 'auth.signup.submit'

function expectSummaryMatchesInlineErrors() {
  const anchors = Array.from(document.querySelectorAll('a[href^="#"]'))
  const inline = Array.from(document.querySelectorAll('p[id$="-error"]'))
  expect(anchors.length).toBe(inline.length)
  for (const anchor of anchors) {
    const id = anchor.getAttribute('href')!.slice(1)
    expect(inline.some((p) => p.id === id)).toBe(true)
  }
}

describe('SignupForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders exactly two fields and the no-card note', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText(EMAIL_LABEL)).toBeInTheDocument()
    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeInTheDocument()
    expect(screen.getByText('auth.signup.no_card_required')).toBeInTheDocument()
    const inputs = document.querySelectorAll('input')
    expect(inputs.length).toBe(2)
  })

  it('shows required errors with aria attributes on empty submit', async () => {
    render(<SignupForm />)
    fireEvent.click(screen.getByText(SUBMIT))
    const email = screen.getByLabelText(EMAIL_LABEL)
    const password = screen.getByLabelText(PASSWORD_LABEL)
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    expect(email).toHaveAttribute('aria-describedby', 'signup-email-error')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('common.errors.required').length).toBeGreaterThanOrEqual(2)
    expectSummaryMatchesInlineErrors()
  })

  it('shows invalid email error for malformed email', async () => {
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'not-an-email' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => expect(screen.getByLabelText(EMAIL_LABEL)).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getAllByText('common.errors.invalid_email').length).toBeGreaterThanOrEqual(2)
  })

  it('shows weak password error for short password', async () => {
    render(<SignupForm />)
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
    expect(screen.getAllByText('common.errors.invalid_password').length).toBeGreaterThanOrEqual(2)
  })

  it('redirects to verify-email with email on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'ok' }, 201))
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'User@Example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/signup/',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(pushMock).toHaveBeenCalledWith('/verify-email?email=User%40Example.com')
  })

  it('shows email taken error for duplicate email', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          email: ['A user with this email address already exists.'],
          code: { email: ['email_taken'] },
        },
        400,
      ),
    )
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'taken@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect((await screen.findAllByText('auth.signup.error_email_taken')).length).toBeGreaterThanOrEqual(2)
  })

  it('shows weak password error from server', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ password: ['This password is too short.'] }, 400),
    )
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect((await screen.findAllByText('auth.signup.error_weak_password')).length).toBeGreaterThanOrEqual(2)
  })

  it('shows network error when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect(await screen.findByText('common.errors.network')).toBeInTheDocument()
  })

  it('renders the password minimum note adjacent to the password field', () => {
    render(<SignupForm />)
    const password = screen.getByLabelText(PASSWORD_LABEL)
    const note = screen.getByText('auth.signup.password_requirements')
    expect(note).toBeInTheDocument()
    const passwordWrapper = password.parentElement!
    expect(passwordWrapper.contains(note)).toBe(true)
    expect(password).toHaveAttribute('aria-describedby', 'signup-password-requirements')
  })

  it('shows a form-level error summary with aria-live and jump links on invalid submit', async () => {
    render(<SignupForm />)
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => expect(screen.getByText('common.errors.summary_title')).toBeInTheDocument())
    const anchors = screen
      .getAllByText('common.errors.required')
      .filter((el) => el.tagName === 'A')
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual([
      '#signup-email-error',
      '#signup-password-error',
    ])
    const summary = screen.getByText('common.errors.summary_title').parentElement
    expect(summary).toHaveAttribute('aria-live', 'polite')
  })

  it('renders inline per-field errors before the form-level summary', async () => {
    render(<SignupForm />)
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => expect(screen.getByText('common.errors.summary_title')).toBeInTheDocument())
    const inline = document.getElementById('signup-email-error')!
    const summaryTitle = screen.getByText('common.errors.summary_title')
    expect(inline.compareDocumentPosition(summaryTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps tab order email, password, the CTA, then the login link', () => {
    const { container } = render(<SignupForm />)
    const focusables = Array.from(container.querySelectorAll('input, a[href], button'))
    expect(focusables.map((el) => el.id || el.textContent)).toEqual([
      'signup-email',
      'signup-password',
      SUBMIT,
      'auth.signup.login_link',
    ])
  })

  it('keeps tab order with the summary anchors between the fields and the CTA on invalid submit', async () => {
    const { container } = render(<SignupForm />)
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => expect(screen.getByText('common.errors.summary_title')).toBeInTheDocument())
    const focusables = Array.from(container.querySelectorAll('input, a[href], button'))
    expect(focusables.map((el) => el.id || el.textContent)).toEqual([
      'signup-email',
      'signup-password',
      'common.errors.required',
      'common.errors.required',
      SUBMIT,
      'auth.signup.login_link',
    ])
  })

  it('ignores a second submit while a request is in flight', async () => {
    let resolveFetch: (value: Response) => void
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(PASSWORD_LABEL), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText(SUBMIT))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(screen.getByText(SUBMIT))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveFetch!(jsonResponse({ detail: 'ok' }, 201))
  })
})
