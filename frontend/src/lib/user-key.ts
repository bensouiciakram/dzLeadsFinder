import type { SessionUser } from '@/lib/api/auth-service'

// The cache-key identity for anonymous vs authenticated sessions — the ONE
// derivation for every userKey-tagged query key (M8: previously duplicated
// as `user?.email ?? 'guest'` across 9 call sites; a split would have
// split the react-query cache per surface).
export function userKey(user: SessionUser | null): string {
  return user?.email ?? 'guest'
}