'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSession } from '@/components/providers/SessionProvider'
import { LocaleSwitcher } from '@/components/locale/LocaleSwitcher'
import { CreditsPill } from '@/components/layout/CreditsPill'
import { SubscriptionChip } from '@/components/layout/SubscriptionChip'
import { UserMenu } from '@/components/layout/UserMenu'

export function Header() {
  const { isAuthenticated, status, logout } = useSession()
  const t = useTranslations('common.nav')
  const [loggingOut, setLoggingOut] = useState(false)

  const desktopLinkClass =
    'text-small text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm'

  return (
    <header
      dir="ltr"
      className="sticky top-0 z-50 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-gutter md:px-gutter-desktop"
    >
      <Link
        href="/"
        className="flex min-w-0 items-center gap-2 no-underline"
        aria-label="DzLeadsFinder"
      >
        <Image
          src="/dz-leads-finder-logo.png"
          alt="DzLeadsFinder"
          width={59}
          height={32}
          unoptimized
          className="h-8 w-auto shrink-0"
        />
        <span className="hidden text-title font-semibold text-foreground xl:inline">
          DzLeadsFinder
        </span>
      </Link>

      <nav className="hidden items-center gap-4 lg:flex">
        {status === 'loading' ? null : isAuthenticated ? (
          <>
            <Link href="/search" className={desktopLinkClass}>
              {t('search')}
            </Link>
            <CreditsPill />
            <SubscriptionChip />
            <Link href="/billing" className={desktopLinkClass}>
              {t('billing')}
            </Link>
            <Link href="/settings" className={desktopLinkClass}>
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
            <Link href="/login" className={desktopLinkClass}>
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

      <div className="flex items-center gap-1.5 lg:hidden">
        <CreditsPill />
        <SubscriptionChip />
        <LocaleSwitcher />
        <UserMenu
          isAuthenticated={isAuthenticated}
          onLogout={() => {
            setLoggingOut(true)
            void logout()
          }}
        />
      </div>
    </header>
  )
}
