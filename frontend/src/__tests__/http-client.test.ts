import { AxiosError, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'

import {
  applyAuthRedirect,
  authRedirectFor,
  redirectTargetForError,
} from '@/lib/api/http-client'

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

function axiosErrorWithResponse(status: number, data: unknown) {
  const response = {
    status,
    statusText: 'Error',
    headers: {},
    data,
    config: { headers: {} },
  } as AxiosResponse
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, response)
}

describe('authRedirectFor', () => {
  it('maps email_not_verified to the verify-email gate', () => {
    expect(authRedirectFor('email_not_verified')).toBe('/verify-email')
  })

  it('maps session_expired to login with the reason param', () => {
    expect(authRedirectFor('session_expired')).toBe('/login?reason=session_expired')
  })

  it('maps account_deleted to the frozen screen', () => {
    expect(authRedirectFor('account_deleted')).toBe('/frozen')
  })

  it('maps token_not_valid and account_inactive to login', () => {
    expect(authRedirectFor('token_not_valid')).toBe('/login')
    expect(authRedirectFor('account_inactive')).toBe('/login')
  })

  it('returns null for guest and unknown codes', () => {
    expect(authRedirectFor('not_authenticated')).toBeNull()
    expect(authRedirectFor('anything_else')).toBeNull()
  })
})

describe('redirectTargetForError', () => {
  it('extracts a string code from a 401 axios error', () => {
    const error = axiosErrorWithResponse(401, { code: 'session_expired' })
    expect(redirectTargetForError(error)).toBe('/login?reason=session_expired')
  })

  it('ignores non-401 statuses', () => {
    const error = axiosErrorWithResponse(400, { code: 'email_taken' })
    expect(redirectTargetForError(error)).toBeNull()
  })

  it('returns null when no response is present (network failure)', () => {
    expect(redirectTargetForError(new Error('offline'))).toBeNull()
  })
})

describe('applyAuthRedirect', () => {
  it('navigates when the target differs from the current path', () => {
    const navigated = applyAuthRedirect('/verify-email')
    expect(navigated).toBe(true)
  })

  it('skips navigation when already on the target path', () => {
    window.history.pushState({}, '', '/verify-email')
    expect(applyAuthRedirect('/verify-email')).toBe(false)
  })

  it('compares paths only, ignoring query strings', () => {
    window.history.pushState({}, '', '/login')
    expect(applyAuthRedirect('/login?reason=session_expired')).toBe(false)
  })

  it('does nothing for a null target', () => {
    expect(applyAuthRedirect(null)).toBe(false)
  })
})
