'use client'

import { useCallback, useRef } from 'react'

// The modal focus-restore contract (Sally M4): capture the invoking
// control at open, hand Base UI a finalFocus callback that returns it on
// close — falling back to the body when the host surface unmounted the
// control. Shared by the recovery and upgrade dialog providers; the ref
// also lets a body re-focus specific controls after async loads.
export function useFocusRestore(externalRef?: React.RefObject<HTMLElement | null>) {
  const internalRef = useRef<HTMLElement | null>(null)
  // An owner that renders the dialog body in a SEPARATE component (the
  // provider pattern) passes its ref through so capture and restore read
  // the same element.
  const lastFocusRef = (externalRef ?? internalRef) as React.MutableRefObject<
    HTMLElement | null
  >

  const captureFocus = useCallback(() => {
    lastFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [lastFocusRef])

  const finalFocus = useCallback(() => {
    const target = lastFocusRef.current
    if (target !== null && document.contains(target)) return target
    return null
  }, [lastFocusRef])

  return { lastFocusRef, captureFocus, finalFocus }
}
