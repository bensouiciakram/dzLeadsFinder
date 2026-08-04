'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSession } from '@/components/providers/SessionProvider'
import { LocaleSwitcher } from '@/components/locale/LocaleSwitcher'

export function Header() {
  const { isAuthenticated, status, logout } = useSession()
  const t = useTranslations('common.nav')
  const [loggingOut, setLoggingOut] = useState(false)

  return (
    <header dir="ltr" className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-gutter px-gutter-desktop">
      <Link href="/" className="flex items-center gap-2 no-underline" aria-label="dzLeadsFinder">
        <Image
          src="/dz-leads-finder-logo.png"
          alt="dzLeadsFinder"
          width={59}
          height={32}
          unoptimized
          className="h-8 w-auto"
        />
        <span className="text-title font-semibold text-foreground">dzLeadsFinder</span>
      </Link>
      <nav className="flex items-center gap-4">
        {status === 'loading' ? null : isAuthenticated ? (
          <>
            <Link href="/search" className="text-small text-muted-foreground hover:text-foreground">
              {t('search')}
            </Link>
            <Link href="/credits" className="text-small text-muted-foreground hover:text-foreground">
              {t('credits')}
            </Link>
            <Link href="/billing" className="text-small text-muted-foreground hover:text-foreground">
              {t('billing')}
            </Link>
            <Link href="/settings" className="text-small text-muted-foreground hover:text-foreground">
              {t('settings')}
            </Link>
            <span className="text-small text-muted-foreground">|</span>
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true)
                void logout()
              }}
              className="text-small text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {t('logout')}
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-small text-muted-foreground hover:text-foreground"
            >
              {t('login')}
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {t('start_free')}
            </Link>
          </>
        )}
        <LocaleSwitcher />
      </nav>
    </header>
  )
}
