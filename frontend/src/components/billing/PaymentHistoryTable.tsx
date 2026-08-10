'use client'

import { Fragment } from 'react'
import { useLocale, useTranslations } from 'next-intl'

import {
  formatBillingDate,
  numerals,
  SUPPORT_EMAIL,
  type HistoryResult,
} from '@/lib/api/billing-service'
import type { BillingPhase } from '@/hooks/useBilling'

type Props = {
  history: HistoryResult | null
  phase: BillingPhase
}

const DOT_CLASSES: Record<string, string> = {
  succeeded: 'bg-success',
  failed: 'bg-danger',
  pending: 'bg-warning',
  refunded: 'bg-muted-foreground',
}

export function PaymentHistoryTable({ history, phase }: Props) {
  const t = useTranslations('billing')
  const states = useTranslations('common.states')
  const locale = useLocale()

  if (phase === 'idle') {
    return null
  }

  return (
    <section className="mt-8">
      <h2 className="text-headline font-semibold text-foreground">{t('history.title')}</h2>
      {phase === 'loading' ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-6 md:p-8">
          <p className="text-small text-muted-foreground">{states('loading')}</p>
        </div>
      ) : phase === 'error' || history === null ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-6 md:p-8">
          <p role="alert" className="text-small text-destructive">
            {states('error')}
          </p>
        </div>
      ) : history.results.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-6 md:p-8">
          <p className="text-small text-muted-foreground">{t('history.empty')}</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="table-fixed w-full border-collapse text-small">
            <thead>
              <tr className="text-small font-semibold text-muted-foreground">
                <th scope="col" className="w-[24%] border-b border-border px-3 py-3 text-start">
                  {t('history.date')}
                </th>
                <th scope="col" className="w-[16%] border-b border-border px-3 py-3 text-start">
                  {t('history.amount')}
                </th>
                <th scope="col" className="w-[32%] border-b border-border px-3 py-3 text-start">
                  {t('history.type')}
                </th>
                <th scope="col" className="w-[28%] border-b border-border px-3 py-3 text-start">
                  {t('history.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.results.map((row) => {
                const typeLabel = {
                  subscription_creation: t('history.type_subscription_creation'),
                  subscription_renewal: t('history.type_subscription_renewal'),
                  pack_purchase: t('history.type_pack_purchase'),
                }[row.type]
                const statusLabel = {
                  pending: t('history.status_pending'),
                  succeeded: t('history.status_paid'),
                  failed: t('history.status_failed'),
                  refunded: t('history.status_refunded'),
                }[row.status]
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b border-border last:border-b-0 hover:bg-muted">
                      <td className="px-3 py-3 text-start">
                        <bdi className="tabular-nums">
                          {formatBillingDate(row.date, locale, { withTime: true })}
                        </bdi>
                      </td>
                      <td className="px-3 py-3 text-start tabular-nums">
                        {numerals(row.amount_dzd)} {t('currency')}
                      </td>
                      <td className="px-3 py-3 text-start">{typeLabel ?? row.type}</td>
                      <td className="px-3 py-3 text-start">
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={`size-2 rounded-full ${DOT_CLASSES[row.status] ?? 'bg-muted-foreground'}`}
                          />
                          {statusLabel ?? row.status}
                        </span>
                      </td>
                    </tr>
                    {row.status === 'failed' ? (
                      <tr>
                        <td colSpan={4} className="border-b border-border px-3 py-3 text-caption text-muted-foreground last:border-b-0">
                          {t.rich('history.failed_note', {
                            support: () => (
                              <a
                                href={`mailto:${SUPPORT_EMAIL}`}
                                className="underline text-destructive"
                              >
                                {t('history.support_link')}
                              </a>
                            ),
                          })}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
