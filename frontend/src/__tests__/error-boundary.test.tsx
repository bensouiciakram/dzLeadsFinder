import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import ErrorPage from '@/app/[locale]/error'

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

describe('ErrorPage (error boundary)', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    consoleError.mockClear()
  })

  it('renders the fallback with title, description and actions', () => {
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />)
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('An unexpected error occurred on this page. Please try again.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to home page' })).toBeInTheDocument()
  })

  it('calls reset when retry is clicked', () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('boom')} reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('logs the error to the console', () => {
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />)
    expect(consoleError).toHaveBeenCalled()
  })
})