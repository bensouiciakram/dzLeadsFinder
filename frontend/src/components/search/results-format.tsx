import Link from 'next/link'

import type { Wilaya } from '@/data/wilayas'

export const KNOWN_BANDS = ['1-10', '11-50', '51-200', '201-500', '500+']

export function bandLabelKey(band: string): string | null {
  if (!KNOWN_BANDS.includes(band)) return null
  return `search.size.${band.replace('-', '_').replace('+', '_plus')}`
}

export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text) && !/[\u0041-\u024F]/.test(text)
}

export function wilayaDisplayName(wilaya: Wilaya, locale: string): string {
  if (locale === 'ar') return wilaya.name_ar
  if (locale === 'fr') return wilaya.name_fr || wilaya.name_ar
  return wilaya.name_en || wilaya.name_ar
}

export function wilayaDisplayLabel(wilaya: Wilaya, locale: string): string {
  return `${wilaya.code} — ${wilayaDisplayName(wilaya, locale)}`
}

export function filterWilayas(wilayas: Wilaya[], query: string): Wilaya[] {
  const q = query.trim().toLowerCase().replace(/^0+(?=\d)/, '')
  if (!q) return wilayas
  return wilayas.filter(
    (wilaya) =>
      String(wilaya.code).startsWith(q) ||
      wilaya.name_ar.toLowerCase().includes(q) ||
      wilaya.name_fr.toLowerCase().includes(q) ||
      wilaya.name_en.toLowerCase().includes(q),
  )
}

export function MaybeArabic({ text }: { text: string }) {
  if (!isArabic(text)) return <>{text}</>
  return (
    <span lang="ar" dir="rtl">
      {text}
    </span>
  )
}

export function EmDash() {
  return <span className="text-muted-foreground">—</span>
}

export function WilayaCell({ code, name }: { code: number | null; name: string | null }) {
  if (code === null || name === null) return <EmDash />
  return (
    <span>
      <span className="tabular-nums">{code}</span> — <MaybeArabic text={name} />
    </span>
  )
}

export function WilayaLine({ code, name }: { code: number | null; name: string | null }) {
  return (
    <p className="mt-0.5 text-small text-muted-foreground">
      {code === null || name === null ? (
        <EmDash />
      ) : (
        <span>
          <span className="tabular-nums">{code}</span> — <MaybeArabic text={name} />
        </span>
      )}
    </p>
  )
}

export function CompanyLink({ name, companyId }: { name: string | null; companyId: string | null }) {
  if (!name || companyId === null) return <EmDash />
  return (
    <Link
      href={`/companies/${companyId}`}
      className="text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm focus-visible:outline-none"
    >
      <MaybeArabic text={name} />
    </Link>
  )
}
