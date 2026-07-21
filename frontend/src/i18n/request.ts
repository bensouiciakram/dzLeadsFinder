import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { routing, LOCALES } from './routing'

export default getRequestConfig(async () => {
  const store = await cookies()
  const localeCookie = store.get('x-locale')?.value
  const locale =
    localeCookie && LOCALES.includes(localeCookie as (typeof LOCALES)[number])
      ? localeCookie
      : routing.defaultLocale

  try {
    const messages = (await import(`../../messages/${locale}.json`)).default
    return { locale, messages }
  } catch {
    const messages = (await import(`../../messages/en.json`)).default
    return { locale, messages }
  }
})
