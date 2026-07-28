import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer } from '@/components/layout/Footer'

describe('Footer', () => {
  it('renders three link columns', () => {
    render(<Footer />)
    expect(screen.getByText('Product')).toBeInTheDocument()
    expect(screen.getByText('Trust')).toBeInTheDocument()
    expect(screen.getByText('Legal')).toBeInTheDocument()
  })

  it('renders Product links', () => {
    render(<Footer />)
    const search = screen.getByText('Search')
    expect(search.closest('a')).toHaveAttribute('href', '/search')
    expect(screen.getByText('Pricing').closest('a')).toHaveAttribute('href', '/#pricing')
    expect(screen.getByText('Wilayas').closest('a')).toHaveAttribute('href', '/wilayas')
  })

  it('renders Trust links', () => {
    render(<Footer />)
    expect(screen.getByText('How we verify').closest('a')).toHaveAttribute('href', '/how-we-verify')
    expect(screen.getByText('About').closest('a')).toHaveAttribute('href', '/about')
  })

  it('renders Legal links', () => {
    render(<Footer />)
    expect(screen.getByText('Privacy').closest('a')).toHaveAttribute('href', '/privacy')
    expect(screen.getByText('Terms').closest('a')).toHaveAttribute('href', '/terms')
    expect(screen.getByText('Refund policy').closest('a')).toHaveAttribute('href', '/refund-policy')
  })

  it('renders founder credit', () => {
    render(<Footer />)
    expect(screen.getByText('Made by Akram in Algiers')).toBeInTheDocument()
  })

  it('renders LocaleSwitcher in footer', () => {
    render(<Footer />)
    const switchers = screen.getAllByLabelText('Switch language')
    expect(switchers.length).toBeGreaterThanOrEqual(1)
  })
})
