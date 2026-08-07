export const creditsKeys = {
  all: ['credits'] as const,
  ledger: (userKey: string, page: number) => ['credits', 'ledger', userKey, page] as const,
  banner: (userKey: string) => ['credits', 'banner', userKey] as const,
}
