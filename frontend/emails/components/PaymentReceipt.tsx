import type { ReactNode } from 'react'
import { Text, Section } from '@react-email/components'
import { BaseEmail } from './BaseEmail'

type Locale = 'ar' | 'fr' | 'en'

type Copy = {
  preview: string
  packPreview: string
  heading: string
  thankYou: string
  amountLabel: string
  creditsLabel: string
  dateLabel: string
  footer: string
  renewalNote: string
  packNote: string
}

const COPY: Record<Locale, Copy> = {
  en: {
    preview: 'Payment received — DzLeadsFinder',
    packPreview: 'Pack purchase confirmed — DzLeadsFinder',
    heading: 'Payment Received',
    thankYou: 'Thank you! Your payment has been processed successfully.',
    amountLabel: 'Amount',
    creditsLabel: 'Credits granted',
    dateLabel: 'Date',
    footer: 'Your new credit balance is available now. Start searching for leads.',
    renewalNote:
      'Your DZLeads Starter subscription renewed — 200 fresh credits are in your account.',
    packNote:
      'Your one-time pack of {n} credits has been added — pack credits never expire.',
  },
  fr: {
    preview: 'Paiement reçu — DzLeadsFinder',
    packPreview: 'Pack acheté confirmé — DzLeadsFinder',
    heading: 'Paiement reçu',
    thankYou: 'Merci ! Votre paiement a été traité avec succès.',
    amountLabel: 'Montant',
    creditsLabel: 'Crédits accordés',
    dateLabel: 'Date',
    footer:
      'Votre nouveau solde de crédits est disponible. Commencez à chercher des prospects.',
    renewalNote:
      'Votre abonnement DZLeads Starter a été renouvelé — 200 nouveaux crédits sont dans votre compte.',
    packNote:
      "Votre pack ponctuel de {n} crédits a été ajouté — les crédits de pack n'expirent jamais.",
  },
  ar: {
    preview: 'تم استلام الدفع — DzLeadsFinder',
    packPreview: 'تم تأكيد شراء الحزمة — DzLeadsFinder',
    heading: 'تم استلام الدفع',
    thankYou: 'شكراً لك! تمت معالجة دفعتك بنجاح.',
    amountLabel: 'المبلغ',
    creditsLabel: 'الائتمانات الممنوحة',
    dateLabel: 'التاريخ',
    footer: 'رصيدك الجديد متاح الآن. ابدأ البحث عن العملاء المحتملين.',
    renewalNote: 'تم تجديد اشتراكك في DZLeads Starter — تمت إضافة 200 ائتمان جديد إلى حسابك.',
    packNote:
      'تمت إضافة حزمة الائتمانات التي اشتريتها ({n} ائتمانًا) — أرصدة الحزم لا تنتهي صلاحيتها أبدًا.',
  },
}

const numerals = (value: number) =>
  new Intl.NumberFormat('en', { useGrouping: true }).format(value)

const formatDate = (isoDate: string, locale: Locale) => {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(parsed)
}

const copyLocale = (locale: string): Locale =>
  locale === 'ar' || locale === 'fr' ? locale : 'en'

// The AR pack note embeds a Latin numeral inside RTL text — without bidi
// isolation the numeral reorders in RTL clients (Sally R2 — the required
// 5.4 fix). en/fr interpolate plainly. The placeholder guard (Edge Hunter
// E10) keeps a copy edit that drops '{n}' from leaking a literal into the
// email.
const renderPackNote = (note: string, n: string, locale: Locale): ReactNode => {
  if (!note.includes('{n}')) {
    return note
  }
  if (locale !== 'ar') {
    return note.replace('{n}', n)
  }
  const [before, after] = note.split('{n}')
  return (
    <>
      {before}
      <bdi>{n}</bdi>
      {after}
    </>
  )
}

type Props = {
  amount: number
  currency?: string
  creditsGranted: number
  date: string
  locale?: string
  isRenewal?: boolean
  isPack?: boolean
}

export function PaymentReceipt({
  amount,
  currency = 'DZD',
  creditsGranted,
  date,
  locale = 'en',
  isRenewal = false,
  isPack = false,
}: Props) {
  const resolved = copyLocale(locale)
  const copy = COPY[resolved]
  const isAr = resolved === 'ar'
  return (
    <BaseEmail previewText={isPack ? copy.packPreview : copy.preview}>
      {/* dir/lang on the root Section — many clients strip <html dir>
          (Sally R6.1 — the AR receipt must not render LTR). */}
      <Section dir={isAr ? 'rtl' : undefined} lang={isAr ? 'ar' : undefined}>
        <Text style={heading}>{copy.heading}</Text>
        <Text style={paragraph}>{copy.thankYou}</Text>
        {isPack && (
          <Text style={paragraph}>
            {renderPackNote(copy.packNote, numerals(creditsGranted || 0), resolved)}
          </Text>
        )}
        {isRenewal && !isPack && (
          <Text style={paragraph}>{copy.renewalNote}</Text>
        )}
        <Section style={detailsBox}>
          <Text style={detailRow}>
            <Text style={detailLabel}>{copy.amountLabel}</Text>
            <Text style={detailValue}>
              {numerals(amount)} {currency}
            </Text>
          </Text>
          <Text style={detailRow}>
            <Text style={detailLabel}>{copy.creditsLabel}</Text>
            <Text style={detailValue}>{numerals(creditsGranted || 0)}</Text>
          </Text>
          <Text style={detailRow}>
            <Text style={detailLabel}>{copy.dateLabel}</Text>
            <Text style={detailValue}>{formatDate(date, resolved)}</Text>
          </Text>
        </Section>
        <Text style={paragraph}>{copy.footer}</Text>
      </Section>
    </BaseEmail>
  )
}

const heading = {
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 16px',
}

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.5',
  color: '#475569',
  margin: '0 0 16px',
}

const detailsBox = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
}

const detailRow = {
  margin: '0 0 8px',
  fontSize: '14px',
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
}

// #334155 (muted-strong) — #64748b (muted-foreground) on the tinted
// #f8fafc box rides the AA contrast line and violates DESIGN.md's
// "muted-foreground never on muted fills" rule (Sally R6.3).
const detailLabel = {
  color: '#334155',
  fontWeight: '600',
  margin: 0,
}

const detailValue = {
  color: '#0f172a',
  fontWeight: '600',
  margin: 0,
}
