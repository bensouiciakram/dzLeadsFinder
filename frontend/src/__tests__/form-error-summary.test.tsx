import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FormErrorSummary } from '@/components/auth/FormErrorSummary'

const SUMMARY_TITLE = 'common.errors.summary_title'

describe('FormErrorSummary', () => {
  it('renders nothing when there are no errors', () => {
    const { container } = render(<FormErrorSummary errors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the summary title and one anchor per error', () => {
    render(
      <FormErrorSummary
        errors={[
          { id: 'login-email-error', message: 'common.errors.required' },
          { id: 'login-password-error', message: 'common.errors.invalid_password' },
        ]}
      />,
    )
    expect(screen.getByText(SUMMARY_TITLE)).toBeInTheDocument()
    const emailAnchor = screen.getByText('common.errors.required')
    expect(emailAnchor.tagName).toBe('A')
    expect(emailAnchor).toHaveAttribute('href', '#login-email-error')
    const passwordAnchor = screen.getByText('common.errors.invalid_password')
    expect(passwordAnchor.tagName).toBe('A')
    expect(passwordAnchor).toHaveAttribute('href', '#login-password-error')
  })

  it('announces errors via aria-live="polite"', () => {
    const { container } = render(
      <FormErrorSummary errors={[{ id: 'login-email-error', message: 'common.errors.required' }]} />,
    )
    const liveRegion = container.firstElementChild
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
  })
})
