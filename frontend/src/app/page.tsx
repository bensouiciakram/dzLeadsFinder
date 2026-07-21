export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold">dzLeadsFinder</h1>
      <p className="mt-4 text-lg text-gray-600">
        Algerian B2B Lead Generation Platform
      </p>
      <div className="mt-8 flex gap-4">
        <span className="rounded bg-green-100 px-3 py-1 text-sm text-green-800">
          Next.js
        </span>
        <span className="rounded bg-blue-100 px-3 py-1 text-sm text-blue-800">
          Django REST Framework
        </span>
      </div>
    </main>
  )
}
