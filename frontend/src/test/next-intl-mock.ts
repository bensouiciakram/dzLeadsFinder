import type { ReactNode } from 'react'

// The shared next-intl test mock (5.7 review P1 — the rich-text pattern).
//
// Mirrors the REAL next-intl v4 semantics exercised against the installed
// library: `{name}` placeholders interpolate VALUES (strings/nodes — a
// FUNCTION for a value placeholder renders null, matching the real
// formatter), and `<tag>…</tag>` pairs invoke the matching param function
// with the interpolated inner text as `chunks`. The 5.5-era mocks only
// handled `{value}` and passed zero-arg functions — which is exactly why
// the dead value-placeholder+function pattern slipped through review.
//
// Every per-file next-intl mock should delegate here so the test double
// can never diverge from the real formatter again.
export async function buildNextIntlMock() {
  const en = (await import('../../messages/en.json')).default as Record<
    string,
    unknown
  >

  function lookup(key: string): string {
    let node: unknown = en
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null) return key
      node = (node as Record<string, unknown>)[part]
      if (node === undefined) return key
    }
    return typeof node === 'string' ? node : key
  }

  function interpolate(
    template: string,
    params: Record<string, unknown>,
  ): ReactNode[] {
    const parts: ReactNode[] = []
    const re = /\{(\w+)\}/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(template)) !== null) {
      if (m.index > last) parts.push(template.slice(last, m.index))
      const value = params[m[1]]
      // A function for a VALUE placeholder renders null — the real
      // next-intl v4 behavior (the dead 5.5 pattern; P1).
      parts.push(typeof value === 'function' ? null : (value as ReactNode))
      last = m.index + m[0].length
    }
    if (last < template.length) parts.push(template.slice(last))
    return parts
  }

  function renderTemplate(
    template: string,
    params: Record<string, unknown>,
  ): ReactNode {
    if (params === undefined) return template
    // 1. Interpolate the value placeholders ({d} inside a tag first — the
    // tag's chunks are the interpolated inner text). A function-valued
    // placeholder renders empty (the real v4 formatter renders null — the
    // dead 5.5 pattern; P1).
    let text = template
    const valueRe = /\{(\w+)\}/g
    let vm: RegExpExecArray | null
    const valueRuns: Array<[number, string, string]> = []
    while ((vm = valueRe.exec(template)) !== null) {
      valueRuns.push([vm.index, vm[1], vm[0]])
    }
    for (const [, name, raw] of valueRuns) {
      const value = params[name]
      text = text.replace(raw, typeof value === 'function' ? '' : String(value ?? ''))
    }
    // 2. Apply the <tag>…</tag> pairs (chunks = the interpolated inner
    // text; non-function params only — functions are tag renderers).
    const parts: ReactNode[] = []
    const tagRe = /<(\w+)>([\s\S]*?)<\/\1>/g
    let last = 0
    let tm: RegExpExecArray | null
    while ((tm = tagRe.exec(text)) !== null) {
      if (tm.index > last) parts.push(text.slice(last, tm.index))
      const renderer = params[tm[1]]
      parts.push(
        typeof renderer === 'function'
          ? (renderer as (chunks: string) => ReactNode)(tm[2])
          : tm[0],
      )
      last = tm.index + tm[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    const flat = parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
    // 3. Any remaining value placeholders outside tags (a caller passing a
    // function for a plain value) — blanked, matching the real formatter.
    return typeof flat === 'string' ? interpolate(flat, params) : flat
  }

  return {
    useLocale: () => 'en',
    useTranslations: (ns?: string) => {
      const fn = (key: string, params?: Record<string, unknown>): ReactNode =>
        renderTemplate(lookup(ns === undefined ? key : `${ns}.${key}`), params ?? {})
      fn.rich = (key: string, params?: Record<string, unknown>): ReactNode =>
        renderTemplate(lookup(ns === undefined ? key : `${ns}.${key}`), params ?? {})
      return fn
    },
  }
}
