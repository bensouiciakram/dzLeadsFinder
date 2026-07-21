import { NextRequest, NextResponse } from 'next/server'

const LOCALES = ['ar', 'fr', 'en'] as const
const DEFAULT_LOCALE = 'fr'

export function middleware(request: NextRequest) {
  const localeHint = request.cookies.get('x-locale-hint')?.value
  const acceptLanguage = request.headers.get('Accept-Language')

  let locale = DEFAULT_LOCALE

  if (localeHint && LOCALES.includes(localeHint as any)) {
    locale = localeHint
  } else if (acceptLanguage) {
    const preferred = acceptLanguage.split(',')[0]?.split('-')[0]
    if (preferred && LOCALES.includes(preferred as any)) {
      locale = preferred
    }
  }

  const response = NextResponse.next()
  response.cookies.set('x-locale-hint', locale, { path: '/' })

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
