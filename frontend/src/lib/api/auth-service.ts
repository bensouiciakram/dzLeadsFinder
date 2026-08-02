import { HttpClient } from './http-client'

export type SessionUser = {
  email: string
  locale: string
  tier: string
  credits_balance: number
  email_verified_at: string | null
}

export class AuthService extends HttpClient {
  async login(email: string, password: string): Promise<void> {
    await this.client.post('/auth/login/', { email, password })
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
