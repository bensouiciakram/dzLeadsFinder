'use client'

import { useId, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Checkbox } from '@/components/ui/checkbox'

type CheckboxGroupOption = {
  value: string
  label: string
}

export type CheckboxGroupProps = {
  id: string
  labelKey: string
  options: CheckboxGroupOption[]
  selected: string[]
  onToggle: (value: string) => void
  onSelectAll: () => void
  onClear: () => void
  // When options exceed this many, collapse to the first `maxVisible`
  // (plus any selected options beyond the cutoff so no active filter is
  // ever hidden) behind a Show more/less toggle.
  maxVisible?: number
}

export function CheckboxGroup({
  id,
  labelKey,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  maxVisible,
}: CheckboxGroupProps) {
  const t = useTranslations()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const allSelected = options.length > 0 && options.every((option) => selected.includes(option.value))

  const collapsible = maxVisible !== undefined && options.length > maxVisible

  const visibleOptions = useMemo(() => {
    if (!collapsible || expanded) return options
    const head = options.slice(0, maxVisible)
    const selectedTail = options
      .slice(maxVisible)
      .filter((option) => selected.includes(option.value))
    return [...head, ...selectedTail]
  }, [options, collapsible, expanded, maxVisible, selected])

  return (
    <fieldset className="min-w-0">
      <legend className="text-caption text-muted-foreground">{t(labelKey)}</legend>
      <div id={listId} className="mt-2 flex flex-col gap-1">
        {visibleOptions.map((option) => {
          const checked = selected.includes(option.value)
          const optionId = `${id}-${option.value}`
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className="flex min-h-11 cursor-pointer items-center gap-2 md:min-h-0"
            >
              <Checkbox id={optionId} checked={checked} onCheckedChange={() => onToggle(option.value)} />
              <span className="text-small">{option.label}</span>
            </label>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={allSelected ? onClear : onSelectAll}
          className="min-h-11 cursor-pointer text-caption text-primary hover:text-primary-hover md:h-8"
        >
          {t(allSelected ? 'search.filters.clear_group' : 'search.filters.select_all')}
        </button>
        {collapsible && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((current) => !current)}
            className="min-h-11 cursor-pointer text-caption text-primary hover:text-primary-hover md:h-8"
          >
            {t(expanded ? 'search.filters.show_less' : 'search.filters.show_more')}
          </button>
        )}
      </div>
    </fieldset>
  )
}
