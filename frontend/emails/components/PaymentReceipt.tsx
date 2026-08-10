import { Text, Section } from '@react-email/components'
import { BaseEmail } from './BaseEmail'

type Locale = 'ar' | 'fr' | 'en'

type Copy = {
  preview: string
  heading: string
  thankYou: string
  amountLabel: string
  creditsLabel: string
  dateLabel: string
  footer: string
  renewalNote: string
}

const COPY: Record<Locale, Copy> = {
  en: {
    preview: 'Payment received — dzLeadsFinder',
    heading: 'Payment Received',
    thankYou: 'Thank you! Your payment has been processed successfully.',
    amountLabel: 'Amount',
    creditsLabel: 'Credits granted',
    dateLabel: 'Date',
    footer: 'Your new credit balance is available now. Start searching for leads.',
    renewalNote:
      'Your DZLeads Starter subscription renewed — 200 fresh credits are in your account.',
  },
  fr: {
    preview: 'Paiement reçu — dzLeadsFinder',
    heading: 'Paiement reçu',
    thankYou: 'Merci ! Votre paiement a été traité avec succès.',
    amountLabel: 'Montant',
    creditsLabel: 'Crédits accordés',
    dateLabel: 'Date',
    footer:
      'Votre nouveau solde de crédits est disponible. Commencez à chercher des prospects.',
    renewalNote:
      'Votre abonnement DZLeads Starter a été renouvelé — 200 nouveaux crédits sont dans votre compte.',
  },
  ar: {
    preview: 'تم استلام الدفع — dzLeadsFinder',
    heading: 'تم استلام الدفع',
    thankYou: 'شكراً لك! تمت معالجة دفعتك بنجاح.',
    amountLabel: 'المبلغ',
    creditsLabel: 'الائتمانات الممنوحة',
    dateLabel: 'التاريخ',
    footer: 'رصيدك الجديد متاح الآن. ابدأ البحث عن العملاء المحتملين.',
    renewalNote: 'تم تجديد اشتراكك في DZLeads Starter — تمت إضافة 200 ائتمان جديد إلى حسابك.',
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

type Props = {
  amount: number
  currency?: string
  creditsGranted: number
  date: string
  locale?: string
  isRenewal?: boolean
}

export function PaymentReceipt({
  amount,
  currency = 'DZD',
  creditsGranted,
  date,
  locale = 'en',
  isRenewal = false,
}: Props) {
  const copy = COPY[locale as Locale] ?? COPY.en
  return (
    <BaseEmail previewText={copy.preview}>
      <Section>
        <Text style={heading}>{copy.heading}</Text>
        <Text style={paragraph}>{copy.thankYou}</Text>
        {isRenewal && <Text style={paragraph}>{copy.renewalNote}</Text>}
        <Section style={detailsBox}>
          <Text style={detailRow}>
            <Text style={detailLabel}>{copy.amountLabel}</Text>
            <Text style={detailValue}>
              {numerals(amount)} {currency}
            </Text>
          </Text>
          <Text style={detailRow}>
            <Text style={detailLabel}>{copy.creditsLabel}</Text>
            <Text style={detailValue}>{numerals(creditsGranted)}</Text>
          </Text>
          <Text style={detailRow}>
            <Text style={detailLabel}>{copy.dateLabel}</Text>
            <Text style={detailValue}>{formatDate(date, copyLocale(locale))}</Text>
          </Text>
        </Section>
        <Text style={paragraph}>{copy.footer}</Text>
      </Section>
    </BaseEmail>
  )
}

const copyLocale = (locale: string): Locale =>
  locale === 'ar' || locale === 'fr' ? locale : 'en'

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

const detailLabel = {
  color: '#64748b',
  fontWeight: '600',
  margin: 0,
}

const detailValue = {
  color: '#0f172a',
  fontWeight: '600',
  margin: 0,
}
