import { describe, expect, it } from 'vitest'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'
import fr from '../../messages/fr.json'

describe('wilaya combobox i18n shapes (×3 locales)', () => {
  it('declares the wilaya_remove interpolation param {name} in every locale', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.filters.wilaya_remove).toContain('{name}')
    }
  })

  it('declares the wilaya_more interpolation param {count} in every locale', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.filters.wilaya_more).toContain('{count}')
    }
  })

  it('declares the wilaya_label and wilaya_clear keys without interpolation params', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.filters.wilaya_label).not.toMatch(/\{\w+\}/)
      expect(messages.search.filters.wilaya_clear).not.toMatch(/\{\w+\}/)
    }
  })

  it('reuses the wilaya group label and the empty-state key', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.filters.wilaya).toBeTruthy()
      expect(messages.trust.wilayas.no_results).toBeTruthy()
    }
  })

  it('resolves every key the combobox renders in all locales', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.filters.wilaya_label).toBeTruthy()
      expect(messages.search.filters.wilaya_placeholder).toBeTruthy()
      expect(messages.search.filters.wilaya_remove).toBeTruthy()
      expect(messages.search.filters.wilaya_clear).toBeTruthy()
      expect(messages.search.filters.wilaya_more).toBeTruthy()
      expect(messages.trust.wilayas.no_results).toBeTruthy()
      expect(messages.search.filters.wilaya).toBeTruthy()
    }
  })
})

describe('saved searches i18n shapes (×3 locales)', () => {
  it('declares the {limit} interpolation param in the cap tooltips in every locale', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.saved.cap_tooltip_free).toContain('{limit}')
      expect(messages.search.saved.cap_tooltip_starter).toContain('{limit}')
    }
  })

  it('resolves every key the saved-searches list renders in all locales', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.saved.title).toBeTruthy()
      expect(messages.search.saved.save).toBeTruthy()
      expect(messages.search.saved.name_placeholder).toBeTruthy()
      expect(messages.search.saved.name_label).toBeTruthy()
      expect(messages.search.saved.name_too_long).toBeTruthy()
      expect(messages.search.saved.empty).toBeTruthy()
      expect(messages.search.saved.delete_confirm).toBeTruthy()
      expect(messages.search.saved.max_capacity).toBeTruthy()
      expect(messages.search.saved.cap_tooltip_free).toBeTruthy()
      expect(messages.search.saved.cap_tooltip_starter).toBeTruthy()
      expect(messages.search.saved.rename).toBeTruthy()
      expect(messages.search.saved.rename_title).toBeTruthy()
      expect(messages.search.saved.retry).toBeTruthy()
      expect(messages.search.saved.actions).toBeTruthy()
    }
  })
})
