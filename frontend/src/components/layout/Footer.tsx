import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LocaleSwitcher } from '@/components/locale/LocaleSwitcher'

const PRODUCT_LINKS = [
  { href: '/search', labelKey: 'links.search' },
  { href: '/#pricing', labelKey: 'links.pricing' },
  { href: '/wilayas', labelKey: 'links.wilayas' },
] as const

const TRUST_LINKS = [
  { href: '/how-we-verify', labelKey: 'links.how_we_verify' },
  { href: '/about', labelKey: 'links.about' },
] as const

const LEGAL_LINKS = [
  { href: '/privacy', labelKey: 'links.privacy' },
  { href: '/terms', labelKey: 'links.terms' },
  { href: '/refund-policy', labelKey: 'links.refund_policy' },
] as const

type LinkColumnLinks = readonly { href: string; labelKey: string }[]

function LinkColumn({ title, links }: { title: string; links: LinkColumnLinks }) {
  const t = useTranslations('footer')
  return (
    <div>
      <h3 className="text-caption font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-small text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(link.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  const t = useTranslations('footer')
  return (
    <footer className="border-t border-border bg-muted px-gutter-desktop py-8">
      <div className="mx-auto grid max-w-content-max-marketing grid-cols-1 gap-8 md:grid-cols-3">
        <LinkColumn title={t('columns.product')} links={PRODUCT_LINKS} />
        <LinkColumn title={t('columns.trust')} links={TRUST_LINKS} />
        <LinkColumn title={t('columns.legal')} links={LEGAL_LINKS} />
      </div>
      <div className="mx-auto mt-8 flex max-w-content-max-marketing flex-col items-center justify-between gap-4 border-t border-border pt-6 md:flex-row">
        <p className="text-small text-muted-foreground">{t('made_by')}</p>
        <LocaleSwitcher />
      </div>
    </footer>
  )
}
