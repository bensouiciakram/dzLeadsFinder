import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/layout/Header'

const { useSessionMock, logoutMock } = vi.hoisted(() => {
  const logoutMock = vi.fn()
  return {
    useSessionMock: vi.fn(() => ({
      isAuthenticated: false,
      status: 'guest',
      logout: logoutMock,
    })),
    logoutMock,
  }
})

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: useSessionMock,
}))

describe('Header (guest)', () => {
  beforeEach(() => {
    logoutMock.mockClear()
    useSessionMock.mockReturnValue({
      isAuthenticated: false,
      status: 'guest',
      logout: logoutMock,
    })
  })

  it('renders logo linking to homepage', () => {
    render(<Header />)
    const logo = screen.getByRole('img', { name: 'dzLeadsFinder' })
    expect(logo).toBeInTheDocument()
    expect(screen.getByText('dzLeadsFinder')).toBeInTheDocument()
    expect(logo.closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('dzLeadsFinder').closest('a')).toHaveAttribute('href', '/')
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

describe('Header (authenticated)', () => {
  beforeEach(() => {
    logoutMock.mockClear()
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      logout: logoutMock,
    })
  })

  it('calls logout when the logout button is clicked', () => {
    render(<Header />)
    fireEvent.click(screen.getByText('logout'))
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it('disables the logout button while a logout is pending', () => {
    render(<Header />)
    const button = screen.getByText('logout')
    fireEvent.click(button)
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })
})
