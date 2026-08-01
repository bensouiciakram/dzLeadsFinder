import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from 'axios'

export function authRedirectFor(code: string): string | null {
  switch (code) {
    case 'email_not_verified':
      return '/verify-email'
    case 'session_expired':
      return '/login?reason=session_expired'
    case 'account_deleted':
      return '/frozen'
    case 'token_not_valid':
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

export function applyAuthRedirect(target: string | null): boolean {
  if (!target) return false
  const targetPath = target.split('?')[0]
  if (window.location.pathname === targetPath) return false
  window.location.assign(target)
  return true
}

export class HttpClient {
  protected readonly client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    })
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError | unknown) => {
        applyAuthRedirect(redirectTargetForError(error))
        return Promise.reject(error)
      },
    )
  }
}
