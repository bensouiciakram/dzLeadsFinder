'use client'

import { useTranslations } from 'next-intl'

type SummaryError = { id: string; message: string }

export function FormErrorSummary({ errors }: { errors: SummaryError[] }) {
  const t = useTranslations()
  if (errors.length === 0) return null

  return (
    <div aria-live="polite" className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-small font-medium text-foreground">{t('common.errors.summary_title')}</p>
      <ul className="mt-1 list-inside list-disc text-small text-destructive">
        {errors.map((error) => (
          <li key={error.id}>
            <a href={`#${error.id}`} className="underline-offset-4 hover:underline">
              {t(error.message)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
