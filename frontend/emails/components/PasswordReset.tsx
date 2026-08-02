import { Text, Link, Section } from '@react-email/components'
import { BaseEmail } from './BaseEmail'

type Locale = 'ar' | 'fr' | 'en'

type Props = {
  resetLink: string
  locale?: string
}

const COPY: Record<Locale, {
  preview: string
  title: string
  description: string
  button: string
  ignore: string
}> = {
  ar: {
    preview: 'إعادة تعيين كلمة المرور — dzLeadsFinder',
    title: 'إعادة تعيين كلمة المرور',
    description:
      'لقد تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك. انقر على الرابط أدناه لتحديد كلمة مرور جديدة. هذا الرابط صالح لمدة ساعة واحدة فقط.',
    button: 'إعادة تعيين كلمة المرور',
    ignore: 'إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان.',
  },
  fr: {
    preview: 'Réinitialisation du mot de passe — dzLeadsFinder',
    title: 'Réinitialisation du mot de passe',
    description:
      "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte. Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe. Ce lien est valable 1 heure.",
    button: 'Réinitialiser le mot de passe',
    ignore: "Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité.",
  },
  en: {
    preview: 'Reset your password — dzLeadsFinder',
    title: 'Reset your password',
    description:
      "We received a request to reset the password for your account. Click the link below to set a new password. This link is valid for 1 hour.",
    button: 'Reset Password',
    ignore: "If you didn't request a password reset, you can safely ignore this email.",
  },
}

export function PasswordReset({ resetLink, locale }: Props) {
  const copy = COPY[(locale as Locale) in COPY ? (locale as Locale) : 'en']
  return (
    <BaseEmail previewText={copy.preview}>
      <Section lang={locale === 'ar' ? 'ar' : undefined} dir={locale === 'ar' ? 'rtl' : undefined}>
        <Text style={heading}>{copy.title}</Text>
        <Text style={paragraph}>{copy.description}</Text>
        <Link href={resetLink} style={button}>
          {copy.button}
        </Link>
        <Text style={paragraph}>{copy.ignore}</Text>
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
