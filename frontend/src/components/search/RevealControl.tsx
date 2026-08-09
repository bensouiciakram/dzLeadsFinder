'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useCredits } from '@/components/providers/CreditProvider'
import { useSession } from '@/components/providers/SessionProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useReveal, type RevealInFlight } from '@/hooks/useReveal'
import type {
  CompanyContact,
  PeopleContact,
  RevealResult,
} from '@/lib/api/reveal-service'
import { revealService } from '@/lib/api/reveal-service'
import { revealKeys } from '@/lib/queryKeys/reveal'
import { cn } from '@/lib/utils'
import type { CompanyResultRow, PeopleResultRow, SearchTab } from '@/lib/api/search-service'
import { bandLabelKey } from './ResultsTable'

const SAFE_URL = /^https?:\/\//i

function Field({ labelKey, children }: { labelKey: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{labelKey}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function PeopleFields({ contact }: { contact: PeopleContact }) {
  const t = useTranslations()
  return (
    <dl className="grid gap-2 text-small" data-testid="reveal-fields">
      <Field labelKey={t('search.reveal.field_email')}>{contact.email ?? '—'}</Field>
      <Field labelKey={t('search.reveal.field_phone')}>
        <span className="tabular-nums">{contact.phone ?? '—'}</span>
      </Field>
      <Field labelKey={t('search.reveal.field_address')}>{contact.address ?? '—'}</Field>
    </dl>
  )
}

function CompanyFields({ contact }: { contact: CompanyContact }) {
  const t = useTranslations()
  const bandKey = contact.size_band === null ? null : bandLabelKey(contact.size_band)
  return (
    <dl className="grid gap-2 text-small" data-testid="reveal-fields">
      {contact.website !== null && (
        <Field labelKey={t('search.reveal.field_website')}>
          {SAFE_URL.test(contact.website) ? (
            <a
              href={contact.website}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {contact.website}
            </a>
          ) : (
            <span className="break-all">{contact.website}</span>
          )}
        </Field>
      )}
      {contact.industry !== null && (
        <Field labelKey={t('search.reveal.field_industry')}>{contact.industry}</Field>
      )}
      {contact.size_band !== null && (
        <Field labelKey={t('search.reveal.field_size_band')}>
          {bandKey === null ? contact.size_band : t(bandKey)}
        </Field>
      )}
    </dl>
  )
}

export type RevealState = {
  recordType: 'people' | 'company'
  userKey: string
  rowId: string
  regionId: string
  contactData: RevealResult | undefined
  revealed: boolean
  pending: boolean
  autoFetching: boolean
  zeroCredits: boolean
  showRegion: boolean
}

export function useRevealState({
  tab,
  row,
}: {
  tab: SearchTab
  row: PeopleResultRow | CompanyResultRow
}): RevealState {
  const { user } = useSession()
  const { balance } = useCredits()
  const queryClient = useQueryClient()

  const recordType: 'people' | 'company' = tab === 'people' ? 'people' : 'company'
  const userKey = user?.email ?? 'guest'
  const rowId = row.id
  const regionId = `reveal-content-${rowId}`

  const cached = queryClient.getQueryData<RevealResult>(
    revealKeys.contact(userKey, recordType, rowId),
  )
  const contactQuery = useQuery({
    queryKey: revealKeys.contact(userKey, recordType, rowId),
    queryFn: () => revealService.reveal(recordType, rowId),
    enabled: row.revealed && cached === undefined,
  })
  const inFlightQuery = useQuery<RevealInFlight>({
    queryKey: revealKeys.inFlight,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  })
  const inFlight = inFlightQuery.data

  const pending = inFlight !== null && inFlight.type === recordType && inFlight.id === rowId
  const contactData = contactQuery.data
  const revealed = row.revealed || contactData !== undefined
  const autoFetching = row.revealed && contactQuery.isFetching
  const zeroCredits = balance !== null && balance <= 0
  const showRegion = pending || contactData !== undefined || autoFetching

  return {
    recordType,
    userKey,
    rowId,
    regionId,
    contactData,
    revealed,
    pending,
    autoFetching,
    zeroCredits,
    showRegion,
  }
}

export function RevealContent({ state }: { state: RevealState }) {
  const t = useTranslations()
  if (!state.showRegion) return null
  return (
    <div
      id={state.regionId}
      role="region"
      aria-label={t('search.reveal.content')}
      data-testid={`reveal-content-${state.rowId}`}
      className="mt-3 border-t border-border pt-3"
    >
      {state.contactData !== undefined ? (
        state.contactData.contact.record_type === 'people' ? (
          <PeopleFields contact={state.contactData.contact} />
        ) : (
          <CompanyFields contact={state.contactData.contact} />
        )
      ) : (
        <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>
      )}
    </div>
  )
}

export function RevealControl({
  tab,
  row,
}: {
  tab: SearchTab
  row: PeopleResultRow | CompanyResultRow
}) {
  const t = useTranslations()
  const state = useRevealState({ tab, row })
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { reveal } = useReveal()

  const handleClick = () => {
    // Synchronous read — onMutate wrote the flag during the first click's
    // event handler; a second click in the same tick must be ignored even
    // before the reactive state re-renders.
    const inFlight = queryClient.getQueryData<RevealInFlight>(revealKeys.inFlight)
    if (inFlight !== null && inFlight !== undefined) return
    if (state.zeroCredits) {
      toast('search.reveal.no_credits')
      return
    }
    // Offline fail-fast (deferred-work manual-testing fix): the POST would
    // hang until the 20s timeout (or indefinitely) — surface the failure
    // surface immediately instead of stranding the spinner.
    if (navigator.onLine === false) {
      toast('search.reveal.failed')
      return
    }
    reveal
      .mutateAsync({ type: state.recordType, id: state.rowId })
      .catch(() => {
        toast('search.reveal.failed')
      })
  }

  if (state.revealed) {
    return (
      <span
        data-testid="reveal-badge"
        className="inline-flex items-center rounded-full bg-success-container px-3 py-1 text-caption font-medium text-success-on-container"
      >
        {t('search.reveal.already_revealed')}
      </span>
    )
  }

  const button = (
    <button
      type="button"
      data-testid="reveal-slot"
      aria-expanded={state.showRegion}
      aria-controls={state.regionId}
      aria-busy={state.pending || undefined}
      aria-disabled={state.zeroCredits || undefined}
      onClick={handleClick}
      className={cn(
        'flex w-full min-h-11 items-center justify-center gap-1.5 rounded-md text-small font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8',
        state.zeroCredits
          ? 'border border-border bg-muted text-muted-strong'
          : 'bg-primary text-primary-foreground',
      )}
    >
      {state.pending ? (
        <>
          <Loader2 data-testid="reveal-spinner" className="size-4 animate-spin" />
          <span className="sr-only">{t('common.actions.reveal')}</span>
        </>
      ) : (
        <>
          <span>{t('common.actions.reveal')}</span>
          <span className="opacity-80">{t('search.reveal.cost')}</span>
        </>
      )}
    </button>
  )

  if (state.zeroCredits) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="block" />}>{button}</TooltipTrigger>
        <TooltipContent>{t('search.reveal.no_credits')}</TooltipContent>
      </Tooltip>
    )
  }
  return button
}
