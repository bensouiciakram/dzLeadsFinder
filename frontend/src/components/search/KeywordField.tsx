'use client'

import { useTranslations } from 'next-intl'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type KeywordFieldProps = {
  id: string
  value: string
  onChange: (value: string) => void
}

export function KeywordField({ id, value, onChange }: KeywordFieldProps) {
  const t = useTranslations()
  const hintId = `${id}-hint`

  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="text-caption text-muted-foreground">
        {t('search.filters.keyword')}
      </Label>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('search.placeholder')}
        aria-describedby={hintId}
        className="mt-2 min-h-11 md:min-h-8"
      />
      <p id={hintId} className="mt-1 text-caption text-muted-foreground">
        {t('search.filters.keyword_hint')}
      </p>
    </div>
  )
}
