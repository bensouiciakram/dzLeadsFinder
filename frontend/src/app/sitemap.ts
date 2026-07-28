import type { MetadataRoute } from 'next'

const LOCALES = ['ar', 'fr', 'en'] as const
const BASE_URL = 'https://dzleadsfinder.dz'

const PAGES = [
  '',
  '/about',
  '/how-we-verify',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/wilayas',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({
    url: `${BASE_URL}${page}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: page === '' ? 1.0 : 0.8,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((lang) => [lang, `${BASE_URL}${page}`])
      ),
    },
  }))
}
