// Key factory discipline (AD-21) — the 5.6 polling success invalidates the
// plan/packs/history keys on the /billing page.
export const billingKeys = {
  plan: (userKey: string) => ['billing', 'plan', userKey] as const,
  packs: (userKey: string) => ['billing', 'packs', userKey] as const,
  history: (userKey: string) => ['billing', 'history', userKey] as const,
  status: (userKey: string, txnId: string) => ['billing', 'status', userKey, txnId] as const,
}
