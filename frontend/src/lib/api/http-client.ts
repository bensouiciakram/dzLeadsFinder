import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
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

  constructor(config?: AxiosRequestConfig) {
    this.client = axios.create({
      baseURL: '/api',
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
      ...config,
    })
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
