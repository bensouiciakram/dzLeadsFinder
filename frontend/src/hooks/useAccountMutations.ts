'use client'

import { useMutation } from '@tanstack/react-query'

import { settingsService } from '@/lib/api/settings-service'

// M11: the DangerZone confirm-deletion flow was a hand-rolled promise
// (submitting flag + try/catch) — the TanStack mutation lifecycle replaces
// it: isPending drives the button, onSuccess/onError live in the component
// via the mutate options (the locale-scoped date formatting stays there).
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (): Promise<{ deletion_scheduled_at: string }> => settingsService.deleteAccount(),
  })
}

// M11: the FrozenAccountPanel recover flow — same hand-rolled pattern. The
// error classification (irreversible / not_frozen / generic) stays in the
// component's mutate options; the hook owns the request lifecycle only.
export function useUndeleteAccount() {
  return useMutation({
    mutationFn: (): Promise<void> => settingsService.undelete(),
  })
}