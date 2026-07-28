import { Text, Section } from '@react-email/components'
import { BaseEmail } from './BaseEmail'

type Props = {
  userName?: string
  packCredits: number
  amount: number
  currency?: string
  neverExpiresNote?: string
}

export function PackReceipt({
  userName,
  packCredits,
  amount,
  currency = 'DZD',
  neverExpiresNote,
}: Props) {
  return (
    <BaseEmail previewText="Credit pack received — dzLeadsFinder">
      <Section>
        <Text style={heading}>Credit Pack Received</Text>
        <Text style={paragraph}>
          Thank you{userName ? `, ${userName}` : ''}! Your credit pack has been added.
        </Text>
        <Section style={detailsBox}>
          <Text style={detailRow}>
            <Text style={detailLabel}>Pack credits</Text>
            <Text style={detailValue}>{packCredits.toLocaleString()}</Text>
          </Text>
          <Text style={detailRow}>
            <Text style={detailLabel}>Amount</Text>
            <Text style={detailValue}>
              {amount.toLocaleString()} {currency}
            </Text>
          </Text>
        </Section>
        {neverExpiresNote && (
          <Text style={paragraph}>{neverExpiresNote}</Text>
        )}
        <Text style={paragraph}>
          Your credits are available now.
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
