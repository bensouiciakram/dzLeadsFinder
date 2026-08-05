'use client'

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
}

export function CheckboxGroup({
  id,
  labelKey,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: CheckboxGroupProps) {
  const t = useTranslations()
  const allSelected = options.length > 0 && options.every((option) => selected.includes(option.value))

  return (
    <fieldset className="min-w-0">
      <legend className="text-caption text-muted-foreground">{t(labelKey)}</legend>
      <div className="mt-2 flex flex-col gap-1">
        {options.map((option) => {
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
      <button
        type="button"
        onClick={allSelected ? onClear : onSelectAll}
        className="mt-1 h-8 cursor-pointer text-caption text-primary hover:text-primary-hover"
      >
        {t(allSelected ? 'search.filters.clear_group' : 'search.filters.select_all')}
      </button>
    </fieldset>
  )
}
