import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

const REFRESH_URL = '/auth/jwt/refresh/'

export function authRedirectFor(code: string): string | null {
  switch (code) {
    case 'email_not_verified':
      return '/verify-email'
    case 'session_expired':
      return '/login?reason=session_expired'
    case 'account_deleted':
      return '/frozen'
    case 'token_not_valid':
    case 'token_not_provided':
    case 'account_inactive':
      return '/login'
    default:
      return null
  }
}

export function redirectTargetForError(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  const status = error.response?.status
  if (status !== 401) return null
  const data = error.response?.data as { code?: unknown } | undefined
  if (typeof data?.code !== 'string') return null
  return authRedirectFor(data.code)
}

export const navigator = {
  assign(target: string): void {
    window.location.assign(target)
  },
}

export function applyAuthRedirect(target: string | null): boolean {
  if (!target) return false
  const targetPath = target.split('?')[0]
  if (window.location.pathname === targetPath) return false
  navigator.assign(target)
  return true
}

function errorCodeOf(error: AxiosError): string | null {
  const data = error.response?.data as { code?: unknown } | undefined
  if (typeof data?.code !== 'string') return null
  return data.code
}

type RetriedConfig = { __authRetried?: boolean }

export class HttpClient {
  protected readonly client: AxiosInstance
  private refreshing: Promise<boolean> | null = null
  private redirectFired = false
  private offlineController: AbortController | null = null

  constructor(config?: AxiosRequestConfig) {
    this.offlineController = new AbortController()
    this.client = axios.create({
      baseURL: '/api',
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
      ...config,
    })
    this.client.interceptors.request.use((requestConfig) =>
      this.attachOfflineSignal(requestConfig),
    )
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', this.abortOffline)
      window.addEventListener('online', this.resetOffline)
    }
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        const code = errorCodeOf(error)
        if (
          code === 'token_not_valid' &&
          error.config?.url !== REFRESH_URL &&
          !(error.config as RetriedConfig | undefined)?.__authRetried
        ) {
          return this.refreshSession().then((refreshed) => {
            if (refreshed && error.config) {
              ;(error.config as RetriedConfig).__authRetried = true
              return this.client.request(error.config)
            }
            this.redirect(error)
            return Promise.reject(error)
          })
        }
        this.redirect(error)
        return Promise.reject(error)
      },
    )
  }

  private redirect(error: AxiosError): void {
    if (this.redirectFired) return
    this.redirectFired = applyAuthRedirect(redirectTargetForError(error))
  }

  private readonly abortOffline = (): void => {
    this.offlineController?.abort()
  }

  private readonly resetOffline = (): void => {
    this.offlineController = new AbortController()
  }

  private attachOfflineSignal(requestConfig: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    // Combine the offline controller with any caller-provided signal (e.g.
    // the search queryFn abort) so the browser-offline abort covers every
    // request of this client. Requests that start while the controller is
    // already aborted fail fast with CanceledError (axios checks the signal
    // before the interceptor chain); the 'online' event recreates the
    // controller, so the failure window is exactly the offline window — a
    // dropped network never strands the UI on a pending spinner
    // (deferred-work manual-testing finding).
    if (!this.offlineController) return requestConfig
    const offlineSignal = this.offlineController.signal
    if (requestConfig.signal) {
      if (typeof AbortSignal.any === 'function') {
        requestConfig.signal = AbortSignal.any([
          offlineSignal,
          requestConfig.signal as AbortSignal,
        ])
      }
      // No AbortSignal.any support: keep the caller's signal (the offline
      // abort is skipped for that request — the timeout still applies).
    } else {
      requestConfig.signal = offlineSignal
    }
    return requestConfig
  }

  private async refreshSession(): Promise<boolean> {
    if (this.refreshing) return this.refreshing
    const attempt = (async () => {
      try {
        await this.client.post(REFRESH_URL)
        return true
      } catch {
        return false
      }
    })()
    this.refreshing = attempt
    try {
      return await attempt
    } finally {
      this.refreshing = null
    }
  }
}
