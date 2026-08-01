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

describe('SignupForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders exactly two fields and the no-card note', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText('email_label')).toBeInTheDocument()
    expect(screen.getByLabelText('password_label')).toBeInTheDocument()
    expect(screen.getByText('no_card_required')).toBeInTheDocument()
    const inputs = document.querySelectorAll('input')
    expect(inputs.length).toBe(2)
  })

  it('shows required errors with aria attributes on empty submit', () => {
    render(<SignupForm />)
    fireEvent.click(screen.getByText('submit'))
    const email = screen.getByLabelText('email_label')
    const password = screen.getByLabelText('password_label')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAttribute('aria-describedby', 'signup-email-error')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText('errors.required').length).toBe(2)
  })

  it('shows invalid email error for malformed email', () => {
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'not-an-email' },
    })
    fireEvent.change(screen.getByLabelText('password_label'), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText('submit'))
    expect(screen.getByLabelText('email_label')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('errors.invalid_email')).toBeInTheDocument()
  })

  it('shows weak password error for short password', () => {
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('password_label'), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByText('submit'))
    expect(screen.getByLabelText('password_label')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('errors.invalid_password')).toBeInTheDocument()
  })

  it('redirects to verify-email with email on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'ok' }, 201))
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'User@Example.com' },
    })
    fireEvent.change(screen.getByLabelText('password_label'), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText('submit'))
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
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'taken@example.com' },
    })
    fireEvent.change(screen.getByLabelText('password_label'), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText('submit'))
    expect(await screen.findByText('error_email_taken')).toBeInTheDocument()
  })

  it('shows weak password error from server', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ password: ['This password is too short.'] }, 400),
    )
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('password_label'), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText('submit'))
    expect(await screen.findByText('error_weak_password')).toBeInTheDocument()
  })

  it('shows network error when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('password_label'), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText('submit'))
    expect(await screen.findByText('errors.network')).toBeInTheDocument()
  })

  it('ignores a second submit while a request is in flight', async () => {
    let resolveFetch: (value: Response) => void
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )
    render(<SignupForm />)
    fireEvent.change(screen.getByLabelText('email_label'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('password_label'), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByText('submit'))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(screen.getByText('submit'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveFetch!(jsonResponse({ detail: 'ok' }, 201))
  })
})
