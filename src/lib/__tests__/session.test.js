import { describe, it, expect } from 'vitest'
import { idleState, formatMMSS, IDLE_MS, WARN_MS } from '../session'

describe('idleState', () => {
  const now = 1_000_000_000_000

  it('active when well within the window', () => {
    const r = idleState(now, now - 60_000) // idle 1 min, limit 15 min
    expect(r.phase).toBe('active')
    expect(r.remainingMs).toBe(IDLE_MS - 60_000)
  })

  it('active just before the warn threshold', () => {
    const last = now - (IDLE_MS - WARN_MS - 1000) // 1s before warn starts
    expect(idleState(now, last).phase).toBe('active')
  })

  it('warn once within the final WARN_MS', () => {
    const last = now - (IDLE_MS - WARN_MS + 1000) // 1s into the warn window
    const r = idleState(now, last)
    expect(r.phase).toBe('warn')
    expect(r.remainingMs).toBeLessThanOrEqual(WARN_MS)
    expect(r.remainingMs).toBeGreaterThan(0)
  })

  it('expired at the idle limit', () => {
    expect(idleState(now, now - IDLE_MS).phase).toBe('expired')
    expect(idleState(now, now - IDLE_MS - 5000).phase).toBe('expired')
    expect(idleState(now, now - IDLE_MS).remainingMs).toBe(0)
  })

  it('respects custom idleMs/warnMs', () => {
    expect(idleState(now, now - 4000, 10_000, 3000).phase).toBe('active')
    expect(idleState(now, now - 8000, 10_000, 3000).phase).toBe('warn')
    expect(idleState(now, now - 10_000, 10_000, 3000).phase).toBe('expired')
  })
})

describe('formatMMSS', () => {
  it('formats minutes and seconds', () => {
    expect(formatMMSS(60_000)).toBe('1:00')
    expect(formatMMSS(5_000)).toBe('0:05')
    expect(formatMMSS(0)).toBe('0:00')
    expect(formatMMSS(125_000)).toBe('2:05')
  })
  it('clamps negatives to 0:00', () => {
    expect(formatMMSS(-5000)).toBe('0:00')
  })
})
