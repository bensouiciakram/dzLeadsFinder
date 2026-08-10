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

describe('PaymentReceipt pack variant (5.4)', () => {
  const PACK = { amount: 500, creditsGranted: 75, date: '2025-01-01', isPack: true }

  it('renders the pack note with the credit count (en)', async () => {
    const html = await render(<PaymentReceipt {...PACK} locale="en" />)
    expect(html).toContain('Your one-time pack of 75 credits has been added')
    expect(html).toContain('pack credits never expire')
  })

  it('renders the pack note in french', async () => {
    const html = await render(<PaymentReceipt {...PACK} locale="fr" />)
    expect(html).toContain('Votre pack ponctuel de 75 crédits a été ajouté')
  })

  it('renders the pack note in arabic with the numeral bidi-isolated', async () => {
    const html = await render(<PaymentReceipt {...PACK} locale="ar" />)
    expect(html).toContain('تمت إضافة حزمة الائتمانات التي اشتريتها')
    expect(html).toContain('<bdi>75</bdi>')
  })

  it('does not render the renewal note for packs', async () => {
    const html = await render(<PaymentReceipt {...PACK} locale="en" />)
    expect(html).not.toContain('200 fresh credits')
  })

  it('never renders the renewal note when both flags are set (pack wins)', async () => {
    const html = await render(
      <PaymentReceipt {...BASE} isRenewal isPack locale="en" />
    )
    expect(html).toContain('Your one-time pack of 200 credits has been added')
    expect(html).not.toContain('renewed')
  })

  it('sets dir rtl and lang ar on the wrapper for arabic', async () => {
    const html = await render(<PaymentReceipt {...PACK} locale="ar" />)
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('lang="ar"')
  })

  it('keeps western numerals for the pack amounts', async () => {
    const html = await render(<PaymentReceipt {...PACK} locale="ar" />)
    expect(html).toContain('500')
    expect(html).toContain('75')
    expect(html).not.toContain('٧٥')
  })
})
