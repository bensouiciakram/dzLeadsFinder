import { LocaleSwitcher } from '@/components/locale/LocaleSwitcher'

export function Footer() {
  return (
    <footer dir="ltr" className="flex h-14 items-center justify-between border-t border-border px-gutter-desktop">
      <span className="text-caption text-muted-foreground">
        &copy; {new Date().getFullYear()} dzLeadsFinder
      </span>
      <LocaleSwitcher />
    </footer>
  )
}
