import { render } from '@react-email/render'
import { describe, expect, it } from 'vitest'
import { PaymentReceipt } from '../../emails/components/PaymentReceipt'

const BASE = { amount: 1500, creditsGranted: 200, date: '2025-01-01' }

describe('PaymentReceipt localization (5.3)', () => {
  it('uses western numerals with grouping for amount and credits', async () => {
    const html = await render(<PaymentReceipt {...BASE} locale="ar" />)
    expect(html).toContain('1,500')
    expect(html).toContain('200')
    expect(html).not.toContain('١٥٠٠')
    expect(html).not.toContain('٢٠٠')
  })

  it('renders arabic copy for ar locale', async () => {
    const html = await render(<PaymentReceipt {...BASE} locale="ar" />)
    expect(html).toContain('تم استلام الدفع')
    expect(html).toContain('المبلغ')
    expect(html).toContain('التاريخ')
  })

  it('renders french copy for fr locale', async () => {
    const html = await render(<PaymentReceipt {...BASE} locale="fr" />)
    expect(html).toContain('Paiement reçu')
    expect(html).toContain('Montant')
    expect(html).toContain('Crédits accordés')
  })

  it('renders english copy by default and for unknown locales', async () => {
    const html = await render(<PaymentReceipt {...BASE} />)
    expect(html).toContain('Payment Received')
    const unknown = await render(<PaymentReceipt {...BASE} locale="de" />)
    expect(unknown).toContain('Payment Received')
  })

  it('shows the renewal note only for renewals', async () => {
    const renewal = await render(<PaymentReceipt {...BASE} isRenewal locale="en" />)
    expect(renewal).toContain('200 fresh credits')
    const creation = await render(<PaymentReceipt {...BASE} locale="en" />)
    expect(creation).not.toContain('200 fresh credits')
  })

  it('formats the date per locale with latin numerals', async () => {
    const ar = await render(<PaymentReceipt {...BASE} locale="ar" />)
    expect(ar).toMatch(/2025|٢٠٢٥/)
    const fr = await render(<PaymentReceipt {...BASE} locale="fr" />)
    expect(fr).toContain('2025')
    expect(fr).not.toContain('٢٠٢٥')
  })

  it('falls back to the raw date string when the date is unparseable (P9)', async () => {
    const html = await render(
      <PaymentReceipt {...BASE} date="not-a-date" locale="en" />
    )
    expect(html).toContain('not-a-date')
  })
})
