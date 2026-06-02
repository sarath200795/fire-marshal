import { describe, it, expect } from 'vitest'
import { applyListFilters, hasActiveFilters, emptyFilters, FILTER_ALL } from '../listFilter'

const items = [
  { serialNo: 'FE-0001', centerName: 'Alpha', type: 'ABC', capacity: '2 Kg', entity: '1P', region: 'North', status: 'active' },
  { serialNo: 'FE-0002', centerName: 'Beta', type: 'CO2', capacity: '5 Kg', entity: '2P', region: 'South', status: 'to_be_refilled' },
  { serialNo: 'FE-0003', centerName: 'Gamma', type: 'ABC', capacity: '5 Kg', entity: '1P', region: 'North', status: 'active' },
]

describe('applyListFilters', () => {
  it('returns all when no filters set', () => {
    expect(applyListFilters(items, emptyFilters())).toHaveLength(3)
  })

  it('filters by a single field', () => {
    expect(applyListFilters(items, { ...emptyFilters(), type: 'ABC' })).toHaveLength(2)
  })

  it('combines multiple filters (AND) — the multi-filter bug case', () => {
    // type=ABC AND region=North AND entity=1P → FE-0001 + FE-0003
    const r = applyListFilters(items, { ...emptyFilters(), type: 'ABC', region: 'North', entity: '1P' })
    expect(r.map((x) => x.serialNo)).toEqual(['FE-0001', 'FE-0003'])
  })

  it('multiple filters that exclude everything return empty', () => {
    // type=CO2 AND region=North → none (CO2 is South)
    expect(applyListFilters(items, { ...emptyFilters(), type: 'CO2', region: 'North' })).toHaveLength(0)
  })

  it('search matches serial, center or type (case-insensitive)', () => {
    expect(applyListFilters(items, { ...emptyFilters(), search: 'beta' })).toHaveLength(1)
    expect(applyListFilters(items, { ...emptyFilters(), search: 'fe-000' })).toHaveLength(3)
    expect(applyListFilters(items, { ...emptyFilters(), search: 'abc' })).toHaveLength(2)
  })

  it('FILTER_ALL is treated as no constraint', () => {
    expect(applyListFilters(items, { ...emptyFilters(), type: FILTER_ALL })).toHaveLength(3)
  })

  it('status applied only when set', () => {
    expect(applyListFilters(items, { ...emptyFilters(), status: 'active' })).toHaveLength(2)
  })

  it('defect matches defectType when present', () => {
    const log = [{ defectType: 'pin' }, { defectType: 'handle' }]
    expect(applyListFilters(log, { ...emptyFilters(), defect: 'pin' })).toHaveLength(1)
  })
})

describe('hasActiveFilters', () => {
  it('false for empty filters', () => {
    expect(hasActiveFilters(emptyFilters())).toBe(false)
  })
  it('true when any field or search is set', () => {
    expect(hasActiveFilters({ ...emptyFilters(), region: 'North' })).toBe(true)
    expect(hasActiveFilters({ ...emptyFilters(), search: 'x' })).toBe(true)
  })
})
