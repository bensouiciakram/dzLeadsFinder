'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'

const COOKIE_NAME = 'x-locale-confirmed'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};samesite=lax`
}

export function ConfirmBanner() {
  const t = useTranslations('common.locale')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!getCookie(COOKIE_NAME))
  }, [])

  const dismiss = () => {
    setCookie(COOKIE_NAME, '1', COOKIE_MAX_AGE)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 bg-info-container px-4 py-3 text-small text-info-on-container"
    >
      <span>{t('inferred_banner')}</span>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="border-info text-info hover:bg-info/10"
          onClick={() => {
            document
              .getElementById('locale-switcher')
              ?.scrollIntoView({ behavior: 'smooth' })
            dismiss()
          }}
        >
          {t('inferred_switch')}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label={t('switch')}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
