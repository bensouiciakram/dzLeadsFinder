import { describe, expect, it } from 'vitest'

import { creditsKeys } from '@/lib/queryKeys/credits'

describe('creditsKeys', () => {
  it('exposes the factory prefix', () => {
    expect(creditsKeys.all).toEqual(['credits'])
  })

  it('scopes ledger entries to the user and page', () => {
    expect(creditsKeys.ledger('a@b.dz', 1)).toEqual(['credits', 'ledger', 'a@b.dz', 1])
    expect(creditsKeys.ledger('a@b.dz', 2)).not.toEqual(creditsKeys.ledger('a@b.dz', 1))
    expect(creditsKeys.ledger('other@x.dz', 1)).not.toEqual(
      creditsKeys.ledger('a@b.dz', 1),
    )
  })

  it('scopes banner entries to the user', () => {
    expect(creditsKeys.banner('a@b.dz')).toEqual(['credits', 'banner', 'a@b.dz'])
    expect(creditsKeys.banner('other@x.dz')).not.toEqual(creditsKeys.banner('a@b.dz'))
  })
})
