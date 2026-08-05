import { describe, expect, it } from 'vitest'

import { INDUSTRIES } from '@/data/industries'

describe('INDUSTRIES', () => {
  it('contains the seeded 35 industries with contiguous ids 1..35', () => {
    expect(INDUSTRIES).toHaveLength(35)
    expect(INDUSTRIES.map((i) => i.id)).toEqual(Array.from({ length: 35 }, (_, idx) => idx + 1))
  })

  it('has non-empty trilingual names for every entry', () => {
    for (const industry of INDUSTRIES) {
      expect(industry.name_ar.length).toBeGreaterThan(0)
      expect(industry.name_fr.length).toBeGreaterThan(0)
      expect(industry.name_en.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate name_en values (backend unique constraint)', () => {
    const names = INDUSTRIES.map((i) => i.name_en)
    expect(new Set(names).size).toBe(names.length)
  })
})
