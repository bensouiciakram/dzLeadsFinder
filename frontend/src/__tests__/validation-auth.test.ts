import { describe, expect, it } from 'vitest'

import { loginSchema, signupSchema, verifyEmailSchema } from '@/lib/validation/auth'

describe('signupSchema', () => {
  it('accepts a valid email and password', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass123!',
    })
    expect(result.success).toBe(true)
  })

  it('requires both fields with the required key', () => {
    const result = signupSchema.safeParse({ email: '', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('common.errors.required')
    }
  })

  it('rejects a malformed email with the invalid_email key', () => {
    const result = signupSchema.safeParse({
      email: 'not-an-email',
      password: 'SecurePass123!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailIssue = result.error.issues.find((issue) => issue.path[0] === 'email')
      expect(emailIssue?.message).toBe('common.errors.invalid_email')
    }
  })

  it('rejects a password shorter than 8 code points (emoji-safe)', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: '1234567',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'password')
      expect(passwordIssue?.message).toBe('common.errors.invalid_password')
    }
  })

  it('counts emoji by code points, not UTF-16 units', () => {
    const sevenEmojis = '🎉'.repeat(7)
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: sevenEmojis,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'password')
      expect(passwordIssue?.message).toBe('common.errors.invalid_password')
    }
  })

  it('accepts a password of exactly 8 code points', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: '🎉'.repeat(8),
    })
    expect(result.success).toBe(true)
  })

  it('rejects a password longer than 128 characters with the weak key', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'x'.repeat(129),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'password')
      expect(passwordIssue?.message).toBe('auth.signup.error_weak_password')
    }
  })
})

describe('verifyEmailSchema', () => {
  it('accepts a valid email', () => {
    expect(verifyEmailSchema.safeParse({ email: 'user@example.com' }).success).toBe(true)
  })

  it('rejects an empty email with the required key', () => {
    const result = verifyEmailSchema.safeParse({ email: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('common.errors.required')
    }
  })

  it('rejects a malformed email with the invalid_email key', () => {
    const result = verifyEmailSchema.safeParse({ email: 'oops' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('common.errors.invalid_email')
    }
  })
})

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass123!',
    })
    expect(result.success).toBe(true)
  })

  it('requires both fields with the required key', () => {
    const result = loginSchema.safeParse({ email: '', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('common.errors.required')
    }
  })

  it('rejects a malformed email with the invalid_email key', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'SecurePass123!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailIssue = result.error.issues.find((issue) => issue.path[0] === 'email')
      expect(emailIssue?.message).toBe('common.errors.invalid_email')
    }
  })

  it('rejects a password shorter than 8 code points', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '1234567' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'password')
      expect(passwordIssue?.message).toBe('common.errors.invalid_password')
    }
  })

  it('counts emoji by code points, not UTF-16 units', () => {
    const sevenEmojis = '🎉'.repeat(7)
    const result = loginSchema.safeParse({ email: 'user@example.com', password: sevenEmojis })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'password')
      expect(passwordIssue?.message).toBe('common.errors.invalid_password')
    }
  })

  it('accepts a password of exactly 8 code points', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '🎉'.repeat(8) })
    expect(result.success).toBe(true)
  })

  it('rejects a password longer than 128 characters', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'x'.repeat(129) })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'password')
      expect(passwordIssue?.message).toBe('common.errors.invalid_password')
    }
  })
})
