import { NextRequest, NextResponse } from 'next/server'
import { render } from '@react-email/render'
import { SignupConfirm } from '../../../../../emails/components/SignupConfirm'
import { PaymentReceipt } from '../../../../../emails/components/PaymentReceipt'
import { PackReceipt } from '../../../../../emails/components/PackReceipt'
import { LowCredit } from '../../../../../emails/components/LowCredit'
import { PasswordReset } from '../../../../../emails/components/PasswordReset'

const TEMPLATES = {
  signup_confirm: SignupConfirm,
  payment_receipt: PaymentReceipt,
  pack_receipt: PackReceipt,
  low_credit: LowCredit,
  password_reset: PasswordReset,
} as const

type TemplateName = keyof typeof TEMPLATES

export async function POST(request: NextRequest) {
  try {
    const { template, locale, context } = (await request.json()) as {
      template: string
      locale?: string
      context: Record<string, unknown>
    }

    if (!(template in TEMPLATES)) {
      return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 })
    }

    const Component = TEMPLATES[template as TemplateName]
    const props = { ...context, locale }
    const html = await render(Component(props as any))
    const plainText = await render(Component(props as any), { plainText: true })

    return NextResponse.json({ html, plainText })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
