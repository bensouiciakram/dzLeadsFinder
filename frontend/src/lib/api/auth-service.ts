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
}

export const authService = new AuthService()
