import { Text, Link, Section } from '@react-email/components'
import { BaseEmail } from './BaseEmail'

type Props = {
  userName?: string
  verificationLink: string
}

export function SignupConfirm({ userName, verificationLink }: Props) {
  return (
    <BaseEmail previewText="Verify your email — dzLeadsFinder">
      <Section>
        <Text style={heading}>Welcome to dzLeadsFinder{userName ? `, ${userName}` : ''}</Text>
        <Text style={paragraph}>
          Please verify your email address to activate your account and start using dzLeadsFinder.
        </Text>
        <Link href={verificationLink} style={button}>
          Verify Email
        </Link>
        <Text style={paragraph}>
          If you didn't sign up for dzLeadsFinder, you can safely ignore this email.
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
