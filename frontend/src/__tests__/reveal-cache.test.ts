import { describe, expect, it } from 'vitest'

import {
  isSearchCache,
  updateSearchResultsWithReveal,
} from '@/lib/reveal/reveal-cache'
import { userKey } from '@/lib/user-key'
import {
  historyQueryOptions,
  packsQueryOptions,
  planQueryOptions,
} from '@/lib/queryOptions/billing'

describe('updateSearchResultsWithReveal', () => {
  it('flips the revealed flag on the matching row and preserves the rest', () => {
    const old = {
      total: 2,
      results: [
        { id: 'a', revealed: false },
        { id: 'b', revealed: false },
      ],
    }
    const next = updateSearchResultsWithReveal(old, 'b')
    expect(next).toEqual({
      total: 2,
      results: [
        { id: 'a', revealed: false },
        { id: 'b', revealed: true },
      ],
    })
    expect(next).not.toBe(old)
    expect((next as { results: unknown[] }).results[0]).toBe(old.results[0])
  })

  it('returns non-search cache entries untouched (same reference)', () => {
    const contact = { contact: { name: 'x' } }
    expect(updateSearchResultsWithReveal(contact, 'a')).toBe(contact)
    expect(updateSearchResultsWithReveal(null, 'a')).toBeNull()
    expect(updateSearchResultsWithReveal('string', 'a')).toBe('string')
  })

  it('guards the cache shape with isSearchCache', () => {
    expect(isSearchCache({ results: [] })).toBe(true)
    expect(isSearchCache({ results: 'nope' })).toBe(false)
    expect(isSearchCache({ other: 1 })).toBe(false)
    expect(isSearchCache(null)).toBe(false)
  })
})

describe('userKey', () => {
  it('uses the email for an authenticated user and guest otherwise', () => {
    expect(userKey({ email: 'a@b.dz' } as never)).toBe('a@b.dz')
    expect(userKey(null)).toBe('guest')
  })
})

describe('billing query options factories', () => {
  const user = { email: 'a@b.dz' } as never

  it('derives plan keys from the user key and gates on the session', () => {
    expect(planQueryOptions(user).queryKey).toEqual(['billing', 'plan', 'a@b.dz'])
    expect(planQueryOptions(user).enabled).toBe(true)
    expect(planQueryOptions(null).queryKey).toEqual(['billing', 'plan', 'guest'])
    expect(planQueryOptions(null).enabled).toBe(false)
  })

  it('derives packs keys with the open-gate AND', () => {
    expect(packsQueryOptions(user, false).enabled).toBe(false)
    expect(packsQueryOptions(user, true).enabled).toBe(true)
    expect(packsQueryOptions(null, true).enabled).toBe(false)
    expect(packsQueryOptions(user, true).queryKey).toEqual(['billing', 'packs', 'a@b.dz'])
  })

  it('derives history keys and gates on the session', () => {
    expect(historyQueryOptions(user).queryKey).toEqual(['billing', 'history', 'a@b.dz'])
    expect(historyQueryOptions(user).enabled).toBe(true)
    expect(historyQueryOptions(null).enabled).toBe(false)
  })
})