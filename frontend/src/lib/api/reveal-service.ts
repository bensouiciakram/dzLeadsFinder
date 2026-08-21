import { HttpClient } from './http-client'

export type PeopleContact = {
  record_type: 'people'
  record_id: string
  name: string
  role: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  address: string | null
}

export type CompanyContact = {
  record_type: 'company'
  record_id: string
  name: string
  industry: string | null
  website: string | null
  wilaya_code: number | null
  size_band: string | null
}

type RevealedContact = PeopleContact | CompanyContact

export type CreditBalances = {
  subscription_balance: number
  pack_balance: number
  display_balance: number
}

export type RevealResult = {
  contact: RevealedContact
  balances: CreditBalances
}

import { isApiCodeError } from '@/lib/api/api-error'

export function isInsufficientCreditsError(error: unknown): boolean {
  return isApiCodeError(error, 402, 'insufficient_credits')
}

export class RevealService extends HttpClient {
  async reveal(recordType: 'people' | 'company', recordId: string): Promise<RevealResult> {
    const { data } = await this.client.post<RevealResult>(
      `/reveal/${recordType}/${recordId}/`,
    )
    return data
  }
}

export const revealService = new RevealService()
