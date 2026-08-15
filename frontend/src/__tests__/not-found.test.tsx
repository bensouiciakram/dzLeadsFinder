import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import NotFoundPage from '@/app/[locale]/not-found'

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

describe('NotFoundPage', () => {
  it('renders the not-found state with a home link', () => {
    render(<NotFoundPage />)
    expect(screen.getByTestId('not-found')).toBeInTheDocument()
    expect(screen.getByText('Page not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to home page' })).toHaveAttribute('href', '/')
  })
})