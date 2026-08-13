import Link from 'next/link'
import { LocaleSwitcher } from '@/components/locale/LocaleSwitcher'

const PRODUCT_LINKS = [
  { href: '/search', label: 'Search' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/wilayas', label: 'Wilayas' },
] as const

const TRUST_LINKS = [
  { href: '/how-we-verify', label: 'How we verify' },
  { href: '/about', label: 'About' },
] as const

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refund-policy', label: 'Refund policy' },
] as const

function LinkColumn({ title, links }: { title: string; links: readonly { href: string; label: string }[] }) {
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
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer dir="ltr" className="border-t border-border bg-muted px-gutter-desktop py-8">
      <div className="mx-auto grid max-w-content-max-marketing grid-cols-1 gap-8 md:grid-cols-3">
        <LinkColumn title="Product" links={PRODUCT_LINKS} />
        <LinkColumn title="Trust" links={TRUST_LINKS} />
        <LinkColumn title="Legal" links={LEGAL_LINKS} />
      </div>
      <div className="mx-auto mt-8 flex max-w-content-max-marketing flex-col items-center justify-between gap-4 border-t border-border pt-6 md:flex-row">
        <p className="text-small text-muted-foreground">
          Made by Akram &amp; Sofiane in Algiers
        </p>
        <LocaleSwitcher />
      </div>
    </footer>
  )
}
