import { describe, expect, it } from 'vitest'

import { searchKeys } from '@/lib/queryKeys/search'

describe('searchKeys', () => {
  it('defines a stable all-scope key', () => {
    expect(searchKeys.all).toEqual(['search'])
  })

  it('defines the disabled-query sentinel', () => {
    expect(searchKeys.idle).toEqual(['search', 'idle'])
  })

  it('scopes tab keys per endpoint', () => {
    expect(searchKeys.tab('people')).toEqual(['search', 'people'])
    expect(searchKeys.tab('companies')).toEqual(['search', 'companies'])
  })

  it('builds full result keys including the submit nonce', () => {
    const key = searchKeys.results('people', '{"industry":[1]}', 2, 'name:desc', 3)
    expect(key).toEqual(['search', 'people', '{"industry":[1]}', 2, 'name:desc', 3])
  })

  it('produces a different key per nonce (fresh-query semantics)', () => {
    const base = searchKeys.results('people', '{}', 1, 'name:asc', 1)
    const next = searchKeys.results('people', '{}', 1, 'name:asc', 2)
    expect(base).not.toEqual(next)
  })

  it('matches the cancel-queries prefix from tab keys', () => {
    const results = searchKeys.results('companies', '{}', 1, 'name:asc', 7)
    expect(results.slice(0, 2)).toEqual(searchKeys.tab('companies'))
  })
})
