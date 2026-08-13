'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

type UserMenuProps = {
  isAuthenticated: boolean
  onLogout: () => void
}

// Mobile navigation drawer (the spine's Header tree slot — desktop keeps
// the inline nav; this island owns the <md surfaces). Uses the shared
// Drawer so the popup inherits the document dir (RTL-safe) and the 44px
// tap-target floor per EXPERIENCE.md.
export function UserMenu({ isAuthenticated, onLogout }: UserMenuProps) {
  const t = useTranslations('common.nav')
  const [open, setOpen] = useState(false)

  // A rotate to desktop mid-open must never leave a stale modal drawer.
  useEffect(() => {
    if (!open) return
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(min-width: 1024px)')
        : null
    if (!media) return
    const onResize = () => {
      if (media.matches) setOpen(false)
    }
    media.addEventListener('change', onResize)
    return () => media.removeEventListener('change', onResize)
  }, [open])

  const itemClass =
    'flex min-h-11 items-center rounded-md px-3 text-small text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        aria-label={t('menu_open')}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="size-5" aria-hidden="true" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="relative border-b border-border">
          <DrawerTitle>{t('menu')}</DrawerTitle>
          <DrawerClose
            aria-label={t('menu_close')}
            className="absolute end-4 top-2 inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" aria-hidden="true" />
          </DrawerClose>
        </DrawerHeader>
        <div className="grow overflow-y-auto p-4">
          {isAuthenticated ? (
            <nav aria-label={t('menu')} className="flex flex-col gap-1">
              <Link href="/search" onClick={() => setOpen(false)} className={itemClass}>
                {t('search')}
              </Link>
              <Link href="/billing" onClick={() => setOpen(false)} className={itemClass}>
                {t('billing')}
              </Link>
              <Link href="/settings" onClick={() => setOpen(false)} className={itemClass}>
                {t('settings')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onLogout()
                }}
                className={`${itemClass} w-full text-start`}
              >
                {t('logout')}
              </button>
            </nav>
          ) : (
            <nav aria-label={t('menu')} className="flex flex-col gap-1">
              <Link href="/login" onClick={() => setOpen(false)} className={itemClass}>
                {t('login')}
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)} className={itemClass}>
                {t('start_free')}
              </Link>
            </nav>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
