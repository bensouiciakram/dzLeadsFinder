'use client'

import Link from 'next/link'
import { useSession } from '@/components/providers/SessionProvider'
import { LocaleSwitcher } from '@/components/locale/LocaleSwitcher'

export function Header() {
  const { isAuthenticated } = useSession()

  return (
    <header dir="ltr" className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-gutter px-gutter-desktop">
      <Link href="/" className="text-title font-semibold text-foreground no-underline">
        dzLeadsFinder
      </Link>
      <nav className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <Link href="/search" className="text-small text-muted-foreground hover:text-foreground">
              Search
            </Link>
            <Link href="/credits" className="text-small text-muted-foreground hover:text-foreground">
              Credits
            </Link>
            <Link href="/billing" className="text-small text-muted-foreground hover:text-foreground">
              Billing
            </Link>
            <Link href="/settings" className="text-small text-muted-foreground hover:text-foreground">
              Settings
            </Link>
            <span className="text-small text-muted-foreground">|</span>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-small text-muted-foreground hover:text-foreground"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-4 py-2 text-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Start Free
            </Link>
          </>
        )}
        <LocaleSwitcher />
      </nav>
    </header>
  )
}
