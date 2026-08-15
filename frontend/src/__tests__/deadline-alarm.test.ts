import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  armDeadlineAlarm,
  clearDeadlineAlarm,
  getDeadlineTick,
  subscribeDeadlineAlarm,
} from '@/lib/billing/deadline-alarm'

describe('deadline alarm (M14 external-time store)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearDeadlineAlarm()
    vi.setSystemTime(new Date('2026-08-15T10:00:00.000Z'))
  })

  afterEach(() => {
    clearDeadlineAlarm()
    vi.useRealTimers()
  })

  it('notifies listeners and bumps the snapshot exactly at the deadline', () => {
    const listener = vi.fn()
    const base = getDeadlineTick()
    const unsubscribe = subscribeDeadlineAlarm(listener)
    armDeadlineAlarm(Date.now() + 5_000)
    vi.advanceTimersByTime(4_999)
    expect(listener).not.toHaveBeenCalled()
    expect(getDeadlineTick()).toBe(base)
    vi.advanceTimersByTime(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getDeadlineTick()).toBe(base + 1)
    unsubscribe()
  })

  it('does nothing for an already-passed deadline (no notify, no tick bump)', () => {
    const listener = vi.fn()
    const base = getDeadlineTick()
    subscribeDeadlineAlarm(listener)
    armDeadlineAlarm(Date.now() - 1)
    vi.advanceTimersByTime(60_000)
    expect(listener).not.toHaveBeenCalled()
    expect(getDeadlineTick()).toBe(base)
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeDeadlineAlarm(listener)
    armDeadlineAlarm(Date.now() + 1_000)
    unsubscribe()
    vi.advanceTimersByTime(1_000)
    expect(listener).not.toHaveBeenCalled()
  })

  it('clear cancels a pending alarm', () => {
    const listener = vi.fn()
    subscribeDeadlineAlarm(listener)
    armDeadlineAlarm(Date.now() + 1_000)
    clearDeadlineAlarm()
    vi.advanceTimersByTime(2_000)
    expect(listener).not.toHaveBeenCalled()
  })

  it('re-arming replaces the previous alarm (single timer)', () => {
    const listener = vi.fn()
    subscribeDeadlineAlarm(listener)
    armDeadlineAlarm(Date.now() + 10_000)
    armDeadlineAlarm(Date.now() + 500)
    vi.advanceTimersByTime(1_000)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})