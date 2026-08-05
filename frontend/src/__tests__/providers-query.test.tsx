import { useQuery, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Providers } from '@/components/providers/Providers'

vi.mock('@/lib/api/auth-service', () => ({
  authService: {
    me: vi.fn().mockRejectedValue({ response: { status: 401 } }),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  },
}))

function Probe() {
  const client = useQueryClient()
  const { data } = useQuery({
    queryKey: ['providers-gate'],
    queryFn: async () => 'ok',
  })
  return (
    <div>
      <span data-testid="has-client">{client ? 'yes' : 'no'}</span>
      <span data-testid="query-data">{data ?? 'pending'}</span>
    </div>
  )
}

describe('Providers (AD-20)', () => {
  it('mounts QueryClientProvider so descendants can consume useQuery', async () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    )

    expect(screen.getByTestId('has-client')).toHaveTextContent('yes')
    expect(await screen.findByText('ok')).toBeInTheDocument()
  })
})
