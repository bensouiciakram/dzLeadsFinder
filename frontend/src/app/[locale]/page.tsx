import { getTranslations } from 'next-intl/server'

export default async function Home() {
  const t = await getTranslations('common')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-display font-bold">{t('app.name')}</h1>
      <p className="mt-4 text-body text-muted-foreground">
        {t('app.tagline')}
      </p>
      <p className="mt-2 text-small text-muted-foreground">
        {t('locale.switch')}: {t('locale.ar')} / {t('locale.fr')} / {t('locale.en')}
      </p>
      <div className="mt-8 flex gap-4">
        <span className="rounded bg-green-100 px-3 py-1 text-small text-green-800">
          Next.js
        </span>
        <span className="rounded bg-blue-100 px-3 py-1 text-small text-blue-800">
          Django REST Framework
        </span>
      </div>
    </main>
  )
}
