import { HttpClient } from './http-client'

export type LedgerRow = {
  id: string
  event_type: string
  amount: number
  balance_after: number
  reference_id: string | null
  created_at: string
}

export type LedgerResult = {
  results: LedgerRow[]
  total: number
  page: number
  truncated: boolean
}

export type CreditsBannerState = {
  dismissed: boolean
}

export class CreditsService extends HttpClient {
  async ledger(page: number): Promise<LedgerResult> {
    const { data } = await this.client.get<LedgerResult>('/credits/ledger/', {
      params: { page },
    })
    return data
  }

  async getBanner(): Promise<CreditsBannerState> {
    const { data } = await this.client.get<CreditsBannerState>('/search/credits-banner/')
    return data
  }

  async dismissBanner(): Promise<CreditsBannerState> {
    const { data } = await this.client.put<CreditsBannerState>('/search/credits-banner/', {
      dismissed: true,
    })
    return data
  }
}

export const creditsService = new CreditsService()
