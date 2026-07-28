'use client'

import { useState, useMemo } from 'react'
import type { Wilaya } from '@/data/wilayas'

type Props = {
  wilayas: Wilaya[]
  filterLabel: string
  filterPlaceholder: string
  noResults: string
  columnCode: string
  columnArabic: string
  columnFrench: string
  columnEnglish: string
  tableCaption: string
}

export default function WilayaTable({
  wilayas,
  filterLabel,
  filterPlaceholder,
  noResults,
  columnCode,
  columnArabic,
  columnFrench,
  columnEnglish,
  tableCaption,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return wilayas
    const q = search.trim().toLowerCase()
    return wilayas.filter(
      (w) =>
        String(w.code).startsWith(q) ||
        w.name_ar.toLowerCase().includes(q) ||
        w.name_fr.toLowerCase().includes(q) ||
        w.name_en.toLowerCase().includes(q),
    )
  }, [search, wilayas])

  return (
    <>
      <div className="mb-6">
        <label
          htmlFor="wilaya-filter"
          className="mb-2 block text-small font-medium text-foreground"
        >
          {filterLabel}
        </label>
        <input
          id="wilaya-filter"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={filterPlaceholder}
          className="w-full rounded-md border border-border bg-card px-4 py-2 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary md:w-72"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-body text-muted-foreground">{noResults}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-start text-small">
            <caption className="sr-only">{tableCaption}</caption>
            <thead>
              <tr className="border-b border-border bg-muted">
                <th scope="col" className="px-4 py-3 text-start font-semibold text-foreground">
                  {columnCode}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold text-foreground">
                  {columnArabic}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold text-foreground">
                  {columnFrench}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold text-foreground">
                  {columnEnglish}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr
                  key={w.code}
                  className="border-b border-border last:border-b-0 hover:bg-muted/50"
                >
                  <th
                    scope="row"
                    className="px-4 py-3 text-start tabular-nums text-foreground"
                  >
                    {String(w.code).padStart(2, '0')}
                  </th>
                  <td lang="ar" className="px-4 py-3 text-foreground">
                    {w.name_ar}
                  </td>
                  <td lang="fr" className="px-4 py-3 text-foreground">
                    {w.name_fr}
                  </td>
                  <td lang="en" className="px-4 py-3 text-foreground">
                    {w.name_en}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
