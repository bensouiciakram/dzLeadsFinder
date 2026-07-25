import { LocaleSwitcher } from '@/components/locale/LocaleSwitcher'

export function Header() {
  return (
    <header
      id="locale-switcher"
      dir="ltr"
      className="flex h-14 items-center justify-between border-b border-border px-gutter-desktop"
    >
      <span className="text-title font-semibold">dzLeadsFinder</span>
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
      </div>
    </header>
  )
}
