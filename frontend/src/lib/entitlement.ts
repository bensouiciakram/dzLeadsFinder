// The entitlement vocabulary: the backend owns the tier string, the FE
// narrows it to the two values that gate behavior (quota, export caps,
// recovery routing). Every tier read goes through here — a raw
// `tier === '…'` comparison scattered across components is how the
// free/starter mapping drifts (the backend may add tiers; unknown values
// degrade to 'free', the safe default).
export type EntitlementTier = 'free' | 'starter'

export function entitlementTierOf(
  tier: string | null | undefined,
): EntitlementTier {
  return tier === 'starter' ? 'starter' : 'free'
}
