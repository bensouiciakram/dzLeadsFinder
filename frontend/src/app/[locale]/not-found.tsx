import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { buttonVariants } from '@/components/ui/button'

export default function NotFoundPage() {
  const t = useTranslations('common')

  return (
    <div
      data-testid="not-found"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-title text-foreground">{t('states.not_found')}</h1>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        {t('errors.go_home')}
      </Link>
    </div>
  )
}
