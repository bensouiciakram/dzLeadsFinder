import { HttpClient } from './http-client'

export type SessionUser = {
  email: string
  locale: string
  tier: string
  credits_balance: number
  email_verified_at: string | null
}

// The Django signup serializer's 400 body — field errors drive the
// per-field messages in SignupForm (email_taken / weak password).
export type SignupErrorBody = {
  email?: string[]
  password?: string[]
  code?: { email?: string[] }
}

export class AuthService extends HttpClient {
  async login(email: string, password: string): Promise<void> {
    await this.client.post('/auth/login/', { email, password })
  }

  // M10: signup/resend-verification/verify-email previously bypassed the
  // service layer with raw fetch in the components — the shared interceptor
  // stack (auth-redirect, offline-abort, token refresh) never saw them.
  async signup(email: string, password: string): Promise<void> {
    await this.client.post('/auth/signup/', { email, password })
  }

  async resendVerification(email: string): Promise<void> {
    await this.client.post('/auth/resend-verification/', { email })
  }

  async verifyEmail(token: string): Promise<{ code?: string }> {
    const { data } = await this.client.get<{ code?: string }>(
      `/auth/verify-email/${encodeURIComponent(token)}/`,
    )
    return data
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout/')
  }

  async me(): Promise<SessionUser> {
    const { data } = await this.client.get<SessionUser>('/auth/me/')
    return data
  }

  async refresh(): Promise<void> {
    await this.client.post('/auth/jwt/refresh/')
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.client.post('/auth/password-reset/', { email })
  }

  async validatePasswordResetToken(token: string): Promise<{ code: string }> {
    const { data } = await this.client.get<{ code: string }>(
      `/auth/password-reset/${encodeURIComponent(token)}/`,
    )
    return data
  }

  async confirmPasswordReset(token: string, password: string): Promise<void> {
    await this.client.post(`/auth/password-reset/${encodeURIComponent(token)}/`, { password })
  }
}

export const authService = new AuthService()
