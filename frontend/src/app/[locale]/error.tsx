'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

import { Button, buttonVariants } from '@/components/ui/button'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common.errors')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      data-testid="error-boundary"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-title text-foreground">{t('title')}</h1>
      <p className="text-small text-muted-foreground">{t('description')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset} className="min-h-11 md:min-h-8">
          {t('try_again')}
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          {t('go_home')}
        </Link>
      </div>
    </div>
  )
}
