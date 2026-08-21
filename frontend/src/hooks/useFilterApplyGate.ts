'use client'

import { useUpgradeDialog } from '@/components/providers/UpgradeDialogProvider'
import { useDispatchTier } from '@/hooks/useDispatchTier'

type UseFilterApplyGateArgs = {
  busy: boolean
  rateLimited: boolean
  onApply: () => void
}

// The single decision point for every Apply click (desktop aside + mobile
// panel). `closePanel` is the surface-specific side effect — the mobile
// panel closes itself, the desktop aside has nothing to close.
export function useFilterApplyGate({ busy, rateLimited, onApply }: UseFilterApplyGateArgs) {
  const { open: openUpgradeDialog } = useUpgradeDialog()
  const dispatchTier = useDispatchTier()

  const runApply = (closePanel?: () => void) => {
    if (busy) return
    if (rateLimited) {
      // 5.7 (John V7 amendment 4 — the AC's "daily-limit state"): the
      // search 429 is tier-keyed (30/day free, 100/day Starter) — a FREE
      // user's click on the aria-disabled Apply opens the Upgrade Dialog
      // (disabled-but-actionable, EXPERIENCE.md L163). A Starter user at
      // the cap has nothing to upgrade into — message only. The export
      // 5,000/24h limit (FR-20) is tier-independent and stays the
      // come-back-tomorrow message — never a dialog.
      //
      // Review P4 (5.7 full review): the mobile filters panel must close
      // FIRST — the success path does close after applying, the
      // rate-limited path previously didn't (two stacked modals — the
      // stack-depth-1 rule).
      closePanel?.()
      if (dispatchTier === 'free') {
        openUpgradeDialog()
      }
      return
    }
    onApply()
    // Close the mobile panel so the results get full width right after the
    // search runs. On md+ the aside stays as the user left it.
    closePanel?.()
  }

  return { runApply }
}
