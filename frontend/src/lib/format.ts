// The shared date formatter (FR-15/AD-8): medium dateStyle, Western
// numerals in every locale via the '-u-nu-latn' suffix, optional short
// time. Invalid input echoes back untouched (the ledger/history cells
// never render "Invalid Date"). One home — the ledger table, the billing
// cards and both deletion-schedule surfaces used to hand-roll variants.
export function formatDate(
  value: string,
  locale: string,
  { withTime = false }: { withTime?: boolean } = {},
): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat(locale + '-u-nu-latn', {
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' as const } : {}),
    }).format(date)
  } catch {
    return value
  }
}
