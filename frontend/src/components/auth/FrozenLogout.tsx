'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useSession } from '@/components/providers/SessionProvider'

export function FrozenLogout() {
  const t = useTranslations('auth.frozen')
  const { logout } = useSession()

  return (
    <Button type="button" variant="outline" className="px-5" onClick={() => void logout()}>
      {t('logout')}
    </Button>
  )
}
