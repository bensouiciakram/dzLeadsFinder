import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/components/layout/AppShell'

vi.mock('next-intl', async () => {
  const mock = await import('@/test/next-intl-mock')
  return mock.buildNextIntlMock()
})

describe('AppShell', () => {
  it('renders children between header and footer', () => {
    render(<AppShell><p>test child</p></AppShell>)
    expect(screen.getByRole('img', { name: 'DzLeadsFinder' })).toBeInTheDocument()
    expect(screen.getByText('test child')).toBeInTheDocument()
    expect(screen.getByText('Made by Akram & Sofiane in Algiers')).toBeInTheDocument()
  })
})
