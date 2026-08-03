'use client'

import { useTranslations } from 'next-intl'

type SummaryError = { id: string; message: string }

export function FormErrorSummary({ errors }: { errors: SummaryError[] }) {
  const t = useTranslations()

  return (
    <div
      aria-live="polite"
      className={
        errors.length > 0 ? 'rounded-md border border-destructive/30 bg-destructive/5 p-3' : ''
      }
    >
      {errors.length > 0 ? (
        <>
          <h2 className="text-small font-medium text-foreground">
            {t('common.errors.summary_title')}
          </h2>
          <ul className="mt-1 list-inside list-disc text-small text-destructive">
            {errors.map((error) => (
              <li key={error.id}>
                <a href={`#${error.id}`} className="underline-offset-4 hover:underline">
                  {t(error.message)}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
