import { Text, Section } from '@react-email/components'
import { BaseEmail } from './BaseEmail'

type Props = {
  userName?: string
  amount: number
  currency?: string
  creditsGranted: number
  date: string
}

export function PaymentReceipt({
  userName,
  amount,
  currency = 'DZD',
  creditsGranted,
  date,
}: Props) {
  return (
    <BaseEmail previewText="Payment received — dzLeadsFinder">
      <Section>
        <Text style={heading}>Payment Received</Text>
        <Text style={paragraph}>
          Thank you{userName ? `, ${userName}` : ''}! Your payment has been processed successfully.
        </Text>
        <Section style={detailsBox}>
          <Text style={detailRow}>
            <Text style={detailLabel}>Amount</Text>
            <Text style={detailValue}>
              {amount.toLocaleString()} {currency}
            </Text>
          </Text>
          <Text style={detailRow}>
            <Text style={detailLabel}>Credits granted</Text>
            <Text style={detailValue}>{creditsGranted.toLocaleString()}</Text>
          </Text>
          <Text style={detailRow}>
            <Text style={detailLabel}>Date</Text>
            <Text style={detailValue}>{date}</Text>
          </Text>
        </Section>
        <Text style={paragraph}>
          Your new credit balance is available now. Start searching for leads.
        </Text>
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
