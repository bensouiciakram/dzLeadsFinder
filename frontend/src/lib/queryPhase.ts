// The shared query-phase derivation: seven hooks used to hand-roll the
// same idle/loading/error/success ladder over a react-query result (each
// with its own local phase type alias). One home here — the per-hook
// aliases stay so their exported type names survive.
export type QueryPhase = 'idle' | 'loading' | 'error' | 'success'

export function queryPhase(
  enabled: boolean,
  query: { isError: boolean; isPending: boolean },
): QueryPhase {
  return !enabled
    ? 'idle'
    : query.isError
      ? 'error'
      : query.isPending
        ? 'loading'
        : 'success'
}
