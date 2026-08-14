'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { LOCALES, getDir } from '@/i18n/routing'
import { Globe } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

const localeNames: Record<string, string> = {
  ar: 'العربية',
  fr: 'Français',
  en: 'English',
}

export function LocaleSwitcher() {
  const locale = useLocale()
  const t = useTranslations('common.locale')
  const router = useRouter()
  const [announce, setAnnounce] = useState('')

  const handleChange = (newLocale: string | null) => {
    if (!newLocale) return
    document.documentElement.dir = getDir(newLocale)
    document.documentElement.lang = newLocale
    document.cookie = `x-locale=${newLocale};path=/;max-age=31536000;samesite=lax`
    setAnnounce(t('announcement', { locale: localeNames[newLocale] ?? newLocale }))
    router.refresh()
  }

  return (
    <>
      <Select value={locale} onValueChange={handleChange}>
        <SelectTrigger
          className="h-9 rounded-md text-small hover:bg-muted [&_svg]:text-muted-foreground"
          aria-label="Switch language"
        >
          <Globe className="size-4 shrink-0" />
          <span className="hidden sm:inline">{localeNames[locale]}</span>
        </SelectTrigger>
        <SelectContent>
          {LOCALES.map((l) => (
            <SelectItem
              key={l}
              value={l}
              className={l === 'ar' ? 'font-arabic' : ''}
            >
              {localeNames[l]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </>
  )
}
