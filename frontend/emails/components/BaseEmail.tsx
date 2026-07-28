import type { ReactNode } from 'react'
import {
  Html,
  Body,
  Container,
  Head,
  Preview,
} from '@react-email/components'

type Props = {
  children: ReactNode
  previewText: string
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '600px',
}

export function BaseEmail({ children, previewText }: Props) {
  return (
    <Html dir="auto">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>{children}</Container>
      </Body>
    </Html>
  )
}
