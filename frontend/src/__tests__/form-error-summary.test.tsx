import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FormErrorSummary } from '@/components/auth/FormErrorSummary'

const SUMMARY_TITLE = 'common.errors.summary_title'

describe('FormErrorSummary', () => {
  it('keeps the polite live region mounted without content when there are no errors', () => {
    const { container } = render(<FormErrorSummary errors={[]} />)
    const region = container.firstElementChild
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByText(SUMMARY_TITLE)).not.toBeInTheDocument()
    expect(container.querySelector('a')).toBeNull()
  })

  it('renders the summary title as a heading and one anchor per error', () => {
    render(
      <FormErrorSummary
        errors={[
          { id: 'login-email-error', message: 'common.errors.required' },
          { id: 'login-password-error', message: 'common.errors.invalid_password' },
        ]}
      />,
    )
    const title = screen.getByText(SUMMARY_TITLE)
    expect(title.tagName).toBe('H2')
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

  it('renders anchors inside an RTL container without throwing', () => {
    const { container } = render(
      <div dir="rtl">
        <FormErrorSummary errors={[{ id: 'login-email-error', message: 'common.errors.required' }]} />
      </div>,
    )
    expect(screen.getByText(SUMMARY_TITLE)).toBeInTheDocument()
    expect(container.querySelector('a')).toHaveAttribute('href', '#login-email-error')
  })
})
