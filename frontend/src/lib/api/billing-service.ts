import { HttpClient } from './http-client'
import type { CreditBalances } from './reveal-service'

export type PlanResult = {
  tier: string
  status: string | null
  renews_on: string | null
  balances: CreditBalances
}

export type Pack = {
  amount: number
  credits: number
  description: string
  unit_price: string
  never_expires: boolean
  best_value: boolean
}

export type PacksResult = {
  packs: Pack[]
  never_expires: boolean
}

export type HistoryRow = {
  id: string
  date: string
  amount_dzd: number
  type: string
  status: string
  credits_granted: number | null
}

export type HistoryResult = {
  results: HistoryRow[]
}

export type CancelResult = {
  status: 'cancelled'
  cancelled_at: string
}

export type CheckoutType = 'subscription' | 'pack'

export type CheckoutResult = {
  checkout_url: string
  checkout_id: string
}

// The FE sends the server price so create-checkout passes its price check;
// the server is authoritative (a mismatch is a loud 400 — price drift
// alarm, 5.3 D5). Same value as apps/billing/pricing.py SUBSCRIPTION_PRICE_DZD.
export const SUBSCRIPTION_PRICE_DZD = 1500

export type BillingApiError = {
  response?: { status?: number; data?: { code?: string } }
}

function isCodeError(
  error: unknown,
  status: number,
  code: string,
): error is BillingApiError & { response: { status: number } } {
  if (typeof error !== 'object' || error === null) return false
  const apiError = error as BillingApiError
  return (
    apiError.response?.status === status && apiError.response?.data?.code === code
  )
}

export function isSubscriptionNotActiveError(error: unknown): boolean {
  return isCodeError(error, 409, 'subscription_not_active')
}

export function isSubscriptionNotFoundError(error: unknown): boolean {
  return isCodeError(error, 409, 'subscription_not_found')
}

// The failed-row support contact (Payment History explanatory line — Sally
// R1d). Single source: the table links mailto:SUPPORT_EMAIL.
export const SUPPORT_EMAIL = 'support@dzleadsfinder.com'

// AD-8: Western digits with grouping in every locale (the PaymentReceipt
// numerals() shape — reuse, never write new formatting code).
export const numerals = (value: number): string =>
  new Intl.NumberFormat('en', { useGrouping: true }).format(value)

export function formatBillingDate(
  value: string,
  locale: string,
  { withTime }: { withTime: boolean },
): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    // '-u-nu-latn' forces Western numerals in every locale (FR-15/AD-8);
    // withTime mirrors the CreditsPage formatTimestamp precedent (history
    // cells), without it the DangerZone dateStyle-medium precedent (cards).
    return new Intl.DateTimeFormat(locale + '-u-nu-latn', {
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' as const } : {}),
    }).format(date)
  } catch {
    return value
  }
}

export class BillingService extends HttpClient {
  async plan(): Promise<PlanResult> {
    const { data } = await this.client.get<PlanResult>('/billing/plan/')
    return data
  }

  async packs(): Promise<PacksResult> {
    const { data } = await this.client.get<PacksResult>('/billing/packs/')
    return data
  }

  async history(): Promise<HistoryResult> {
    const { data } = await this.client.get<HistoryResult>('/billing/history/')
    return data
  }

  async cancel(): Promise<CancelResult> {
    const { data } = await this.client.post<CancelResult>('/billing/cancel/')
    return data
  }

  async createCheckout(type: CheckoutType, amount: number): Promise<CheckoutResult> {
    const { data } = await this.client.post<CheckoutResult>('/billing/create-checkout/', {
      type,
      amount,
    })
    return data
  }
}

export const billingService = new BillingService()
