import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function GateProbe() {
  const { data } = useQuery({
    queryKey: ['tanstack-query-gate'],
    queryFn: async () => 'ok',
  })
  return <span data-testid="gate-result">{data ?? 'pending'}</span>
}

describe('AD-20 TanStack Query gate check', () => {
  it('mounts QueryClientProvider and resolves a useQuery under the vitest 2.x/Vite-CJS stack', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <GateProbe />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('gate-result')).toHaveTextContent('ok')
    })
  })
})
