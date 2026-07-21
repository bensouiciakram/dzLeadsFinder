import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ar', 'fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'never',
  localeCookie: {
    name: 'x-locale',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax' as const,
  },
})

export type Locale = (typeof routing.locales)[number]
export const LOCALES = routing.locales
export const DEFAULT_LOCALE = routing.defaultLocale

export function getDir(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}
