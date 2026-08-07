import { describe, expect, it } from 'vitest'

import { exportKeys } from '@/lib/queryKeys/export'

describe('exportKeys factory (AD-21)', () => {
  it('exposes the all-prefix key as a readonly tuple', () => {
    expect(exportKeys.all).toEqual(['export'])
    const key: readonly string[] = exportKeys.all
    expect(key).toHaveLength(1)
  })
})
