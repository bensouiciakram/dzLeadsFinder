import { describe, expect, it } from 'vitest'

import { revealKeys } from '@/lib/queryKeys/reveal'

describe('revealKeys', () => {
  it('exposes the factory prefix', () => {
    expect(revealKeys.all).toEqual(['reveal'])
  })

  it('scopes contact entries to the user, record type and id', () => {
    expect(revealKeys.contact('a@b.dz', 'people', 'abc')).toEqual([
      'reveal',
      'contact',
      'a@b.dz',
      'people',
      'abc',
    ])
    expect(revealKeys.contact('other@x.dz', 'company', 'def')).not.toEqual(
      revealKeys.contact('a@b.dz', 'company', 'def'),
    )
  })

  it('exposes the shared in-flight key', () => {
    expect(revealKeys.inFlight).toEqual(['reveal', 'in-flight'])
  })
})
