import { describe, it, expect } from 'vitest'
import { statsDeltaFor, accumulate, emptyStats } from '../stats'

const ext = (over = {}) => ({ status: 'active', type: 'ABC', entity: '1P', region: 'North', ...over })

describe('statsDeltaFor', () => {
  it('create: +1 total and each bucket', () => {
    const d = statsDeltaFor(null, ext())
    expect(d.total).toBe(1)
    expect(d.byStatus.active).toBe(1)
    expect(d.byType.ABC).toBe(1)
    expect(d.byEntity['1P']).toBe(1)
    expect(d.byRegion.North).toBe(1)
  })

  it('delete: -1 total and buckets', () => {
    const d = statsDeltaFor(ext(), null)
    expect(d.total).toBe(-1)
    expect(d.byStatus.active).toBe(-1)
  })

  it('soft-deleted after is treated as removal', () => {
    const d = statsDeltaFor(ext(), ext({ deletedAt: '2026-06-01' }))
    expect(d.total).toBe(-1)
  })

  it('restore (deleted before → active after) nets +1', () => {
    const d = statsDeltaFor(ext({ deletedAt: '2026-06-01' }), ext())
    expect(d.total).toBe(1)
  })

  it('status change nets the two buckets, total unchanged', () => {
    const d = statsDeltaFor(ext({ status: 'active' }), ext({ status: 'closed' }))
    expect(d.total).toBe(0)
    expect(d.byStatus.active).toBe(-1)
    expect(d.byStatus.closed).toBe(1)
  })

  it('region change moves the region bucket only', () => {
    const d = statsDeltaFor(ext({ region: 'North' }), ext({ region: 'South' }))
    expect(d.total).toBe(0)
    expect(d.byRegion.North).toBe(-1)
    expect(d.byRegion.South).toBe(1)
    expect(d.byType.ABC).toBe(0)
  })
})

describe('accumulate', () => {
  it('counts active and ignores soft-deleted', () => {
    const s = accumulate([
      ext(),
      ext({ status: 'closed', type: 'CO2' }),
      ext({ deletedAt: '2026-06-01' }), // excluded
    ])
    expect(s.total).toBe(2)
    expect(s.byStatus.active).toBe(1)
    expect(s.byStatus.closed).toBe(1)
    expect(s.byType.ABC).toBe(1)
    expect(s.byType.CO2).toBe(1)
  })
  it('emptyStats is zeroed', () => {
    expect(accumulate([])).toEqual(emptyStats())
  })
})
