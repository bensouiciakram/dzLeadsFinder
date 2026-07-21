import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const messagesDir = resolve(process.cwd(), 'messages')
const locales = ['ar', 'fr', 'en']

function loadMessages(locale) {
  const filePath = resolve(messagesDir, `${locale}.json`)
  if (!existsSync(filePath)) {
    console.error(`Missing file: ${filePath}`)
    process.exit(1)
  }
  const content = readFileSync(filePath, 'utf-8')
  return JSON.parse(content)
}

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

const enMessages = loadMessages('en')
const enKeys = flattenKeys(enMessages)

console.log(`EN keys: ${enKeys.length}`)

let allPass = true

for (const locale of locales) {
  if (locale === 'en') continue
  const messages = loadMessages(locale)
  const keys = flattenKeys(messages)
  console.log(`${locale.toUpperCase()} keys: ${keys.length}`)

  const missing = enKeys.filter((k) => !keys.includes(k))
  if (missing.length > 0) {
    console.error(`\nMissing keys in ${locale.toUpperCase()}:`)
    for (const key of missing) {
      console.error(`  - ${key}`)
    }
    allPass = false
  }

  const extra = keys.filter((k) => !enKeys.includes(k))
  if (extra.length > 0) {
    console.error(`\nExtra keys in ${locale.toUpperCase()} (not in EN):`)
    for (const key of extra) {
      console.error(`  - ${key}`)
    }
    allPass = false
  }
}

if (allPass) {
  console.log('\nAll translation keys are present. ✓')
  process.exit(0)
} else {
  process.exit(1)
}
