'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { useSession } from '@/components/providers/SessionProvider'
import { settingsService, type FrozenStatus } from '@/lib/api/settings-service'
import { FrozenLogout } from './FrozenLogout'

type PanelPhase = 'loading' | 'ready' | 'irreversible' | 'error'

export function FrozenAccountPanel() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const { refresh } = useSession()
  const [phase, setPhase] = useState<PanelPhase>('loading')
  const [status, setStatus] = useState<FrozenStatus | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [recoverError, setRecoverError] = useState(false)

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const data = await settingsService.frozenStatus()
      setStatus(data)
      setPhase(data.days_left > 0 ? 'ready' : 'irreversible')
    } catch {
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function recover() {
    if (recovering) return
    setRecovering(true)
    setRecoverError(false)
    try {
      await settingsService.undelete()
      const result = await refresh()
      if (result === 'authenticated') {
        router.push('/search')
      } else {
        setRecoverError(true)
      }
    } catch {
      setRecoverError(true)
    } finally {
      setRecovering(false)
    }
  }

  const scheduledDate =
    status?.deletion_scheduled_at != null
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
          new Date(status.deletion_scheduled_at),
        )
      : null

  return (
    <div>
      {phase === 'loading' ? (
        <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>
      ) : null}

      {phase === 'error' ? (
        <>
          <p role="alert" className="text-small text-destructive">
            {t('auth.frozen.status_error')}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" className="px-5" onClick={() => void load()}>
              {t('auth.frozen.retry')}
            </Button>
            <FrozenLogout />
          </div>
        </>
      ) : null}

      {phase === 'irreversible' ? (
        <>
          <p className="mt-4 text-small text-foreground">{t('auth.frozen.irreversible')}</p>
          <div className="mt-6">
            <FrozenLogout />
          </div>
        </>
      ) : null}

      {phase === 'ready' && status != null ? (
        <>
          <p className="mt-4 text-small text-foreground">
            {t('auth.frozen.scheduled_on', { date: scheduledDate ?? '' })}
          </p>
          <p className="mt-2 text-small text-muted-foreground">
            {t('auth.frozen.days_left', { days: status.days_left })}
          </p>
          {recoverError ? (
            <p role="alert" className="mt-4 text-small text-destructive">
              {t('auth.frozen.recover_error')}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="px-5"
              disabled={recovering}
              onClick={() => void recover()}
            >
              {recovering ? t('auth.frozen.recovering') : t('auth.frozen.recover')}
            </Button>
            <FrozenLogout />
          </div>
        </>
      ) : null}
    </div>
  )
}
