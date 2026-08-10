// Key factory discipline (AD-21) — registered now so 5.6's polling success
// invalidates the same plan key on the /billing page.
export const billingKeys = {
  all: ['billing'] as const,
  plan: (userKey: string) => ['billing', 'plan', userKey] as const,
  packs: (userKey: string) => ['billing', 'packs', userKey] as const,
  history: (userKey: string) => ['billing', 'history', userKey] as const,
}
