import { Text, Link, Section } from '@react-email/components'
import { BaseEmail } from './BaseEmail'

type Props = {
  userName?: string
  remainingCredits: number
  topUpLink: string
}

export function LowCredit({ userName, remainingCredits, topUpLink }: Props) {
  return (
    <BaseEmail previewText="Low on credits — DzLeadsFinder">
      <Section>
        <Text style={heading}>Low on Credits</Text>
        <Text style={paragraph}>
          Hi{userName ? ` ${userName}` : ''}, you only have{' '}
          <Text style={highlight}>{remainingCredits.toLocaleString()} credits</Text> remaining.
        </Text>
        <Text style={paragraph}>
          Top up now to keep searching for leads without interruption.
        </Text>
        <Link href={topUpLink} style={button}>
          Top Up Credits
        </Link>
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

const highlight = {
  fontWeight: '700',
  color: '#dc2626',
}

const button = {
  display: 'inline-block',
  padding: '12px 24px',
  backgroundColor: '#0f766e',
  color: '#ffffff',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '16px',
  fontWeight: '600',
  margin: '8px 0 16px',
}
