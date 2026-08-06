'use client'

import { CheckCircle2Icon, CircleIcon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { useSession } from '@/components/providers/SessionProvider'
import { useChecklist } from '@/hooks/useChecklist'
import { useChecklistMutations } from '@/hooks/useChecklistMutations'
import type { ChecklistStep } from '@/lib/api/checklist-service'

const STEPS: readonly { step: ChecklistStep; labelKey: string }[] = [
  { step: 'search', labelKey: 'search.checklist.step_search' },
  { step: 'reveal', labelKey: 'search.checklist.step_reveal' },
  { step: 'export', labelKey: 'search.checklist.step_export' },
]

export type ChecklistCardProps = {
  onStepComplete?: (step: ChecklistStep) => void
}

export function ChecklistCard({ onStepComplete }: ChecklistCardProps) {
  const t = useTranslations()
  const { user } = useSession()
  const { state, phase, completed } = useChecklist({ user })
  const { dismiss } = useChecklistMutations()
  const onStepCompleteRef = useRef(onStepComplete)
  onStepCompleteRef.current = onStepComplete
  const prevCompletedRef = useRef<ChecklistStep[] | null>(null)

  useEffect(() => {
    if (phase !== 'success') return
    // A dismissed card is dead UI — never announce flips on a card the user
    // already dismissed (e.g. dismiss + first search racing in one refetch).
    if (state?.dismissed === true) return
    const prev = prevCompletedRef.current
    prevCompletedRef.current = completed
    if (prev === null) return
    for (const step of completed) {
      if (!prev.includes(step)) onStepCompleteRef.current?.(step)
    }
  }, [completed, phase, state?.dismissed])

  if (phase !== 'success' || state === null || state.dismissed || completed.length === 3) {
    return null
  }

  return (
    <section
      aria-labelledby="checklist-card-title"
      data-testid="checklist-card"
      className="rounded-lg border border-border bg-card p-gutter"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="checklist-card-title" className="text-title">
          {t('search.checklist.title')}
        </h2>
        <Button
          type="button"
          variant="ghost"
          aria-label={t('search.checklist.dismiss')}
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate()}
          className="min-h-11 min-w-11 md:min-h-8 md:min-w-8"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {STEPS.map(({ step, labelKey }) => {
          const complete = completed.includes(step)
          return (
            <li key={step} className="flex items-center gap-2">
              {complete ? (
                <CheckCircle2Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-success"
                />
              ) : (
                <CircleIcon aria-hidden="true" className="size-4 shrink-0 text-border" />
              )}
              <span
                className={
                  complete
                    ? 'text-small text-muted-foreground'
                    : 'text-small text-foreground'
                }
              >
                {t(labelKey)}
              </span>
              <span className="sr-only">
                {complete ? t('search.checklist.complete') : t('search.checklist.pending')}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
