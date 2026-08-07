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

describe('checklist card i18n shapes (×3 locales)', () => {
  it('declares no interpolation params in the checklist family', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.checklist.title).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.step_search).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.step_reveal).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.step_export).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.complete).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.pending).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.dismiss).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.done_search).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.done_reveal).not.toMatch(/\{\w+\}/)
      expect(messages.search.checklist.done_export).not.toMatch(/\{\w+\}/)
    }
  })

  it('resolves every key the checklist card renders in all locales', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.checklist.title).toBeTruthy()
      expect(messages.search.checklist.step_search).toBeTruthy()
      expect(messages.search.checklist.step_reveal).toBeTruthy()
      expect(messages.search.checklist.step_export).toBeTruthy()
      expect(messages.search.checklist.complete).toBeTruthy()
      expect(messages.search.checklist.pending).toBeTruthy()
      expect(messages.search.checklist.dismiss).toBeTruthy()
      expect(messages.search.checklist.done_search).toBeTruthy()
      expect(messages.search.checklist.done_reveal).toBeTruthy()
      expect(messages.search.checklist.done_export).toBeTruthy()
    }
  })
})

describe('reveal surface i18n shapes (×3 locales)', () => {
  const REVEAL_KEYS = [
    'cost',
    'already_revealed',
    'no_credits',
    'failed',
    'deducted',
    'content',
    'field_email',
    'field_phone',
    'field_address',
    'field_website',
    'field_industry',
    'field_size_band',
  ] as const

  it('resolves every key the reveal surface renders in all locales', () => {
    for (const messages of [en, fr, ar] as const) {
      for (const key of REVEAL_KEYS) {
        expect(messages.search.reveal[key]).toBeTruthy()
      }
    }
  })

  it('declares the {balance} interpolation param in deducted in every locale', () => {
    for (const messages of [en, fr, ar] as const) {
      expect(messages.search.reveal.deducted).toContain('{balance}')
    }
  })

  it('declares no interpolation params in the other reveal keys', () => {
    for (const messages of [en, fr, ar] as const) {
      for (const key of REVEAL_KEYS) {
        if (key === 'deducted') continue
        expect(messages.search.reveal[key]).not.toMatch(/\{\w+\}/)
      }
    }
  })
})
