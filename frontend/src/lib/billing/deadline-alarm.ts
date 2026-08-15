// M14: the status card's timeout flip must re-render exactly at the poll
// deadline even when no interval tick lands on it — the previous
// implementation forced that render with a counter state (a render-hack).
// useSyncExternalStore is the correct primitive for time-derived external
// state: subscribe + a snapshot that flips ONCE when the alarm fires.
// Only one StatusCard exists at a time (a single checkout), so a module
// singleton is safe; arm/clear are idempotent per deadline.

type Listener = () => void

const listeners = new Set<Listener>()
let deadlineTick = 0
let alarmTimer: ReturnType<typeof setTimeout> | null = null

export function subscribeDeadlineAlarm(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDeadlineTick(): number {
  return deadlineTick
}

export function armDeadlineAlarm(deadlineMs: number): void {
  clearDeadlineAlarm()
  const remaining = deadlineMs - Date.now()
  // Already past: the current render already derives the timeout state —
  // no notify (a bump here would re-run the arming effect forever).
  if (remaining <= 0) return
  alarmTimer = setTimeout(() => {
    alarmTimer = null
    deadlineTick += 1
    for (const listener of listeners) listener()
  }, remaining)
}

export function clearDeadlineAlarm(): void {
  if (alarmTimer !== null) {
    clearTimeout(alarmTimer)
    alarmTimer = null
  }
}