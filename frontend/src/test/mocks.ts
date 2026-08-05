import { vi } from 'vitest'

if (
  typeof globalThis !== 'undefined' &&
  typeof window !== 'undefined' &&
  typeof (window as unknown as Record<string, unknown>).PointerEvent === 'undefined'
) {
  class PointerEventMock extends MouseEvent {
    pointerId: number
    pointerType: string
    isPrimary: boolean

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 1
      this.pointerType = params.pointerType ?? 'mouse'
      this.isPrimary = params.isPrimary ?? true
    }
  }

  const PointerEventCtor = PointerEventMock as unknown as typeof PointerEvent
  ;(window as unknown as Record<string, unknown>).PointerEvent = PointerEventCtor
  ;(globalThis as unknown as Record<string, unknown>).PointerEvent = PointerEventCtor
}

if (
  typeof document !== 'undefined' &&
  typeof document.elementFromPoint !== 'function'
) {
  document.elementFromPoint = () => {
    const combobox = document.querySelector('[data-slot="combobox-content"]')
    if (combobox) return combobox
    const popup = document.querySelector('[data-slot="drawer-popup"]')
    return popup ?? document.body
  }
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
