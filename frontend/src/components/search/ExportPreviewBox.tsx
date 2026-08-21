'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import type { ExportPreview } from '@/hooks/useExportPreview'
import type { SearchTab } from '@/lib/api/search-service'

function wilayaLabel(name: string | null, code: number | null): string {
  if (name === null && code === null) return ''
  if (name === null) return String(code)
  if (code === null) return name
  return `${name} (${code})`
}

type ExportPreviewBoxProps = {
  tab: SearchTab
  freeTier: boolean
  includeUnrevealed: boolean
  preview: ExportPreview | null
}

export function ExportPreviewBox({
  tab,
  freeTier,
  includeUnrevealed,
  preview,
}: ExportPreviewBoxProps) {
  const t = useTranslations()

  const previewLines = useMemo(() => {
    if (preview === null) return null
    const header =
      tab === 'people'
        ? [
            t('export.modal.header_name'),
            t('export.modal.header_role'),
            t('export.modal.header_company'),
            t('export.modal.header_wilaya'),
          ]
        : [
            t('export.modal.header_name'),
            t('export.modal.header_industry'),
            t('export.modal.header_wilaya'),
            t('export.modal.header_people_count'),
          ]
    // Free tier: the preview IS the file — show exactly the rows that will
    // export (the include_unrevealed filter applies to the preview too, so
    // the preview never claims rows the file won't contain). Starter keeps
    // the 2-row sample + ellipsis (its file is the full set).
    const body = (freeTier
      ? preview.rows.filter((row) => includeUnrevealed || row.revealed)
      : preview.rows.slice(0, 2)
    ).map((row) => {
      const wilaya = wilayaLabel(row.wilaya_name, row.wilaya_code)
      const cells =
        tab === 'people'
          ? [row.name, row.role ?? '', row.company_name ?? '', wilaya]
          : [row.name, row.industry ?? '', wilaya, String(row.people_count)]
      return { key: row.id, text: cells.join(',') }
    })
    return { header: header.join(','), body }
  }, [preview, tab, t, freeTier, includeUnrevealed])

  return (
    <div className="flex flex-col gap-2">
      <div
        dir="ltr"
        role="group"
        aria-label={t('export.modal.preview_label')}
        className="max-h-56 overflow-y-auto overflow-x-hidden rounded-md bg-muted p-3 text-small leading-5 text-muted-strong"
      >
        <p className="mb-1 border-b border-border/60 pb-1 text-caption text-muted-foreground">
          {t('export.modal.preview_notice')}
        </p>
        {freeTier && <p className="font-semibold text-danger">{t('export.watermark')}</p>}
        <p className="break-words">{previewLines?.header}</p>
        {previewLines?.body.map((line) => (
          <p key={line.key} className="break-words">
            {line.text}
          </p>
        ))}
        {(preview?.totalRows ?? 0) > 2 && !freeTier && <p>…</p>}
        {freeTier && <p className="font-semibold text-danger">{t('export.watermark')}</p>}
      </div>
    </div>
  )
}
