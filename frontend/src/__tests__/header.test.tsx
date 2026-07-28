import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/layout/Header'

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: vi.fn(() => ({ isAuthenticated: false })),
}))

describe('Header (guest)', () => {
  it('renders logo linking to homepage', () => {
    render(<Header />)
    const logo = screen.getByText('dzLeadsFinder')
    expect(logo).toBeInTheDocument()
    expect(logo.closest('a')).toHaveAttribute('href', '/')
  })

  it('renders login and signup links for guests', () => {
    render(<Header />)
    expect(screen.getByText('login')).toBeInTheDocument()
    expect(screen.getByText('start_free')).toBeInTheDocument()
  })

  it('renders LocaleSwitcher', () => {
    render(<Header />)
    expect(screen.getByLabelText('Switch language')).toBeInTheDocument()
  })
})
