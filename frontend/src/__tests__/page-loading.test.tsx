import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import LoadingPage from '@/app/[locale]/loading'

describe('LoadingPage', () => {
  it('renders a skeleton shell', () => {
    render(<LoadingPage />)
    expect(screen.getByTestId('page-loading')).toBeInTheDocument()
  })
})