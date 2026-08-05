import { describe, expect, it } from 'vitest'

import { WILAYAS } from '@/data/wilayas'

describe('WILAYAS data shape (FR-10)', () => {
  it('contains exactly the 58 official wilayas', () => {
    expect(WILAYAS).toHaveLength(58)
  })

  it('covers codes 1 to 58 contiguously — no retired or non-existent codes', () => {
    expect(WILAYAS.map((wilaya) => wilaya.code)).toEqual(
      Array.from({ length: 58 }, (_, index) => index + 1),
    )
  })

  it('has trilingual non-blank names for every wilaya', () => {
    for (const wilaya of WILAYAS) {
      expect(wilaya.name_ar, `wilaya ${wilaya.code} name_ar`).not.toBe('')
      expect(wilaya.name_fr, `wilaya ${wilaya.code} name_fr`).not.toBe('')
      expect(wilaya.name_en, `wilaya ${wilaya.code} name_en`).not.toBe('')
    }
  })
})
