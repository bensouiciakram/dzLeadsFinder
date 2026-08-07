import { describe, expect, it } from 'vitest'

import { buildCreditsCsv, type CreditsCsvLabels } from '@/lib/credits/csv'
import type { LedgerRow } from '@/lib/api/credits-service'

const LABELS: CreditsCsvLabels = {
  type: 'Type',
  amount: 'Amount',
  timestamp: 'Date',
  balance_after: 'Balance after',
  reference: 'Reference',
  types: {
    free_signup: 'Signup credits',
    subscription_grant: 'Monthly subscription',
    pack_grant: 'Credit pack purchase',
    promotional_grant: 'Promotional credits',
    reveal_debit: 'Reveal',
    export_row_debit: 'Export',
    expiry: 'Credits expired',
  },
}

function row(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    id: 'row-1',
    event_type: 'free_signup',
    amount: 15,
    balance_after: 15,
    reference_id: null,
    created_at: '2026-08-07T12:00:00+01:00',
    ...overrides,
  }
}

describe('buildCreditsCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    expect(buildCreditsCsv([], LABELS).charCodeAt(0)).toBe(0xfeff)
  })

  it('emits headers only for an empty ledger', () => {
    const csv = buildCreditsCsv([], LABELS).slice(1)
    expect(csv).toBe('Type,Amount,Date,Balance after,Reference\r\n')
  })

  it('maps a grant row with the localized type label and signed amount', () => {
    const csv = buildCreditsCsv([row()], LABELS).slice(1).split('\r\n')
    expect(csv[0]).toBe('Type,Amount,Date,Balance after,Reference')
    expect(csv[1]).toBe('Signup credits,+15,2026-08-07T12:00:00+01:00,15,')
  })

  it('formats debits with an ASCII hyphen-minus', () => {
    const csv = buildCreditsCsv([row({ event_type: 'reveal_debit', amount: -1 })], LABELS)
      .slice(1)
      .split('\r\n')[1]
    expect(csv).toContain('Reveal')
    expect(csv).toContain(',-1,')
  })

  it('keeps the stable column order for grants and debits alike', () => {
    const rows = [
      row({ event_type: 'subscription_grant', amount: 200, balance_after: 200 }),
      row({ event_type: 'expiry', amount: -10, balance_after: 190, id: 'row-2' }),
    ]
    const lines = buildCreditsCsv(rows, LABELS).slice(1).split('\r\n')
    expect(lines[1].split(',')[0]).toBe('Monthly subscription')
    expect(lines[2].split(',')[0]).toBe('Credits expired')
  })

  it('escapes commas, quotes and newlines per RFC-4180', () => {
    const tricky = row({ reference_id: 'a,b"c' })
    const csv = buildCreditsCsv([tricky], LABELS).slice(1).split('\r\n')[1]
    expect(csv).toContain('"a,b""c"')
  })

  it('renders the raw event code as the type fallback for unknown codes', () => {
    const unknown = row({ event_type: 'mystery_event' })
    const csv = buildCreditsCsv([unknown], LABELS).slice(1).split('\r\n')[1]
    expect(csv.split(',')[0]).toBe('mystery_event')
  })

  it('uses Western numerals only (no Arabic-Indic digits in any locale)', () => {
    const arabicLabels: CreditsCsvLabels = {
      ...LABELS,
      type: 'النوع',
      amount: 'الكمية',
      timestamp: 'التاريخ',
      balance_after: 'الرصيد بعد',
      reference: 'المرجع',
      types: { ...LABELS.types },
    }
    const csv = buildCreditsCsv([row()], arabicLabels).slice(1).split('\r\n')[1]
    expect(csv).not.toMatch(/[٠-٩]/)
    expect(csv).toContain('+15')
  })

  it('localizes the header row and type labels for FR', () => {
    const frenchLabels: CreditsCsvLabels = {
      type: 'Type',
      amount: 'Montant',
      timestamp: 'Date',
      balance_after: 'Solde après',
      reference: 'Référence',
      types: {
        free_signup: "Crédits d'inscription",
        subscription_grant: 'Abonnement mensuel',
        pack_grant: 'Achat de pack de crédits',
        promotional_grant: 'Crédits promotionnels',
        reveal_debit: 'Révélation',
        export_row_debit: 'Exportation',
        expiry: 'Crédits expirés',
      },
    }
    const csv = buildCreditsCsv(
      [row({ event_type: 'free_signup' }), row({ event_type: 'expiry', id: 'row-2' })],
      frenchLabels,
    )
      .slice(1)
      .split('\r\n')
    expect(csv[0]).toBe('Type,Montant,Date,Solde après,Référence')
    expect(csv[1]).toContain("Crédits d'inscription")
    expect(csv[2]).toContain('Crédits expirés')
  })
})
