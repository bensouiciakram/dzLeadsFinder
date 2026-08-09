import {
  AxiosError,
  CanceledError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthService } from '@/lib/api/auth-service'
import * as httpClient from '@/lib/api/http-client'
import { applyAuthRedirect, authRedirectFor, redirectTargetForError } from '@/lib/api/http-client'

beforeEach(() => {
  vi.spyOn(httpClient.navigator, 'assign').mockImplementation((target: string) => {
    window.history.pushState({}, '', target.split('?')[0])
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
})

function jsonResponse(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return { data, status, statusText: 'OK', headers: {}, config }
}

function clientWithAdapter(adapter: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse> | never) {
  return new AuthService({ adapter } as AxiosRequestConfig)
}

function axiosErrorWithResponse(status: number, data: unknown, config?: InternalAxiosRequestConfig) {
  const response = {
    status,
    statusText: 'Error',
    headers: {},
    data,
    config: config ?? ({} as InternalAxiosRequestConfig),
  } as AxiosResponse
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, response)
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

  it('maps token_not_valid, token_not_provided and account_inactive to login', () => {
    expect(authRedirectFor('token_not_valid')).toBe('/login')
    expect(authRedirectFor('token_not_provided')).toBe('/login')
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
  it('navigates to the target when it differs from the current path', () => {
    const navigated = applyAuthRedirect('/verify-email')
    expect(navigated).toBe(true)
    expect(httpClient.navigator.assign).toHaveBeenCalledWith('/verify-email')
  })

  it('skips navigation when already on the target path', () => {
    window.history.pushState({}, '', '/verify-email')
    expect(applyAuthRedirect('/verify-email')).toBe(false)
    expect(httpClient.navigator.assign).not.toHaveBeenCalled()
  })

  it('compares paths only, ignoring query strings', () => {
    window.history.pushState({}, '', '/login')
    expect(applyAuthRedirect('/login?reason=session_expired')).toBe(false)
    expect(httpClient.navigator.assign).not.toHaveBeenCalled()
  })

  it('does nothing for a null target', () => {
    expect(applyAuthRedirect(null)).toBe(false)
    expect(httpClient.navigator.assign).not.toHaveBeenCalled()
  })
})

describe('HttpClient offline abort', () => {
  // A signal-aware adapter that never settles on its own — settlement comes
  // exclusively from the abort path (mimics a real in-flight request).
  function pendingAdapter(config: InternalAxiosRequestConfig) {
    return new Promise<AxiosResponse>((_resolve, reject) => {
      const onAbort = () => reject(new CanceledError('canceled', config))
      if (config.signal?.aborted) {
        onAbort()
        return
      }
      config.signal?.addEventListener?.('abort', onAbort)
    })
  }

  it('aborts in-flight requests when the browser goes offline', async () => {
    const client = clientWithAdapter(pendingAdapter)
    const pending = client.me()
    window.dispatchEvent(new Event('offline'))
    await expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    window.dispatchEvent(new Event('online'))
  })

  it('serves requests again after the online event recreates the controller', async () => {
    const client = clientWithAdapter(async (config) =>
      jsonResponse(config, 200, { email: 'user@example.com' }),
    )
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
    const user = await client.me()
    expect(user.email).toBe('user@example.com')
  })

  it('fails fast while offline before the online event lands', async () => {
    // A request started after the abort (no 'online' event yet) rejects
    // instantly with CanceledError — the failure window is exactly the
    // offline window; the 'online' event restores service.
    const client = clientWithAdapter(async (config) =>
      jsonResponse(config, 200, { email: 'user@example.com' }),
    )
    window.dispatchEvent(new Event('offline'))
    await expect(client.me()).rejects.toMatchObject({ code: 'ERR_CANCELED' })
  })
})

describe('HttpClient 401 interceptor', () => {
  it('refreshes once and replays the original request on token_not_valid', async () => {
    let meCalls = 0
    const refreshCalls = vi.fn()
    const client = clientWithAdapter(async (config) => {
      if (config.url === '/auth/me/') {
        meCalls += 1
        if (meCalls === 1) throw axiosErrorWithResponse(401, { code: 'token_not_valid' }, config)
        return jsonResponse(config, 200, { email: 'user@example.com' })
      }
      if (config.url === '/auth/jwt/refresh/') {
        refreshCalls()
        return jsonResponse(config, 200, { detail: 'Token refreshed' })
      }
      throw new Error(`unexpected url: ${config.url}`)
    })
    const user = await client.me()
    expect(user.email).toBe('user@example.com')
    expect(meCalls).toBe(2)
    expect(refreshCalls).toHaveBeenCalledTimes(1)
    expect(httpClient.navigator.assign).not.toHaveBeenCalled()
  })

  it('shares a single refresh across concurrent 401s', async () => {
    const refreshCalls = vi.fn()
    const adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/me/') throw axiosErrorWithResponse(401, { code: 'token_not_valid' }, config)
      if (config.url === '/auth/jwt/refresh/') {
        refreshCalls()
        return jsonResponse(config, 200, { detail: 'Token refreshed' })
      }
      throw new Error(`unexpected url: ${config.url}`)
    }
    const client = clientWithAdapter(adapter)
    const [first, second] = await Promise.allSettled([client.me(), client.me()])
    expect(first.status).toBe('rejected')
    expect(second.status).toBe('rejected')
    expect(refreshCalls).toHaveBeenCalledTimes(1)
  })

  it('redirects to login when the refresh itself fails with token_not_valid', async () => {
    const adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/me/') throw axiosErrorWithResponse(401, { code: 'token_not_valid' }, config)
      throw axiosErrorWithResponse(401, { code: 'token_not_valid' }, config)
    }
    const client = clientWithAdapter(adapter)
    await expect(client.me()).rejects.toBeInstanceOf(AxiosError)
    expect(httpClient.navigator.assign).toHaveBeenCalledWith('/login')
  })

  it('redirects with the session_expired reason when refresh detects inactivity', async () => {
    const adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/me/') throw axiosErrorWithResponse(401, { code: 'token_not_valid' }, config)
      throw axiosErrorWithResponse(401, { code: 'session_expired' }, config)
    }
    const client = clientWithAdapter(adapter)
    await expect(client.me()).rejects.toBeInstanceOf(AxiosError)
    expect(httpClient.navigator.assign).toHaveBeenCalledTimes(1)
    expect(httpClient.navigator.assign).toHaveBeenCalledWith('/login?reason=session_expired')
  })

  it('redirects to the frozen screen when refresh rejects a deleted account', async () => {
    const adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/me/') throw axiosErrorWithResponse(401, { code: 'token_not_valid' }, config)
      throw axiosErrorWithResponse(401, { code: 'account_deleted' }, config)
    }
    const client = clientWithAdapter(adapter)
    await expect(client.me()).rejects.toBeInstanceOf(AxiosError)
    expect(httpClient.navigator.assign).toHaveBeenCalledWith('/frozen')
  })

  it('redirects to the verify-email gate on a replay still failing with email_not_verified', async () => {
    let meCalls = 0
    const adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/me/') {
        meCalls += 1
        if (meCalls === 1) throw axiosErrorWithResponse(401, { code: 'token_not_valid' }, config)
        throw axiosErrorWithResponse(401, { code: 'email_not_verified' }, config)
      }
      return jsonResponse(config, 200, { detail: 'Token refreshed' })
    }
    const client = clientWithAdapter(adapter)
    await expect(client.me()).rejects.toBeInstanceOf(AxiosError)
    expect(httpClient.navigator.assign).toHaveBeenCalledWith('/verify-email')
  })

  it('redirects on a plain 401 without attempting a refresh', async () => {
    const refreshCalls = vi.fn()
    const adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/me/') throw axiosErrorWithResponse(401, { code: 'session_expired' }, config)
      if (config.url === '/auth/jwt/refresh/') {
        refreshCalls()
        return jsonResponse(config, 200, { detail: 'Token refreshed' })
      }
      throw new Error(`unexpected url: ${config.url}`)
    }
    const client = clientWithAdapter(adapter)
    await expect(client.me()).rejects.toBeInstanceOf(AxiosError)
    expect(refreshCalls).not.toHaveBeenCalled()
    expect(httpClient.navigator.assign).toHaveBeenCalledWith('/login?reason=session_expired')
  })
})
