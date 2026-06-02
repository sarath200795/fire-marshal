import { describe, it, expect } from 'vitest'
import { applyListFilters, hasActiveFilters, emptyFilters } from '../listFilter'

const items = [
  { serialNo: 'FE-0001', centerName: 'Alpha', type: 'ABC', capacity: '2 Kg', entity: '1P', region: 'North', status: 'active' },
  { serialNo: 'FE-0002', centerName: 'Beta', type: 'CO2', capacity: '5 Kg', entity: '2P', region: 'South', status: 'to_be_refilled' },
  { serialNo: 'FE-0003', centerName: 'Gamma', type: 'ABC', capacity: '5 Kg', entity: '1P', region: 'North', status: 'in_process_refilling' },
]

describe('applyListFilters', () => {
  it('returns all when no filters set', () => {
    expect(applyListFilters(items, emptyFilters())).toHaveLength(3)
  })

  it('filters by a single value in a field', () => {
    expect(applyListFilters(items, { ...emptyFilters(), type: ['ABC'] })).toHaveLength(2)
  })

  it('OR within a field — multiple values match either (the reported bug)', () => {
    // Status = active OR to_be_refilled → FE-0001 + FE-0002
    const r = applyListFilters(items, { ...emptyFilters(), status: ['active', 'to_be_refilled'] })
    expect(r.map((x) => x.serialNo)).toEqual(['FE-0001', 'FE-0002'])
  })

  it('OR within field returns all three when all statuses selected', () => {
    const r = applyListFilters(items, { ...emptyFilters(), status: ['active', 'to_be_refilled', 'in_process_refilling'] })
    expect(r).toHaveLength(3)
  })

  it('AND across fields, OR within each', () => {
    // type=ABC AND status in [active, in_process] → FE-0001 + FE-0003 (both ABC)
    const r = applyListFilters(items, { ...emptyFilters(), type: ['ABC'], status: ['active', 'in_process_refilling'] })
    expect(r.map((x) => x.serialNo)).toEqual(['FE-0001', 'FE-0003'])
  })

  it('combining fields that exclude everything returns empty', () => {
    // type=CO2 AND region=North → none (CO2 is South)
    expect(applyListFilters(items, { ...emptyFilters(), type: ['CO2'], region: ['North'] })).toHaveLength(0)
  })

  it('search matches serial, center or type (case-insensitive)', () => {
    expect(applyListFilters(items, { ...emptyFilters(), search: 'beta' })).toHaveLength(1)
    expect(applyListFilters(items, { ...emptyFilters(), search: 'fe-000' })).toHaveLength(3)
    expect(applyListFilters(items, { ...emptyFilters(), search: 'abc' })).toHaveLength(2)
  })

  it('empty array = no constraint for that field', () => {
    expect(applyListFilters(items, { ...emptyFilters(), type: [] })).toHaveLength(3)
  })

  it('matches tolerantly across case / whitespace drift (real-world data)', () => {
    const drifted = [
      { serialNo: 'X1', region: 'north', capacity: '5 KG' },
      { serialNo: 'X2', region: 'North ', capacity: '5  Kg' },
    ]
    const r = applyListFilters(drifted, { ...emptyFilters(), region: ['North'], capacity: ['5 Kg'] })
    expect(r).toHaveLength(2)
  })

  it('defect matches defectType when selected', () => {
    const log = [{ defectType: 'pin' }, { defectType: 'handle' }]
    expect(applyListFilters(log, { ...emptyFilters(), defect: ['pin'] })).toHaveLength(1)
    expect(applyListFilters(log, { ...emptyFilters(), defect: ['pin', 'handle'] })).toHaveLength(2)
  })

  it('tolerates a legacy single-string field value', () => {
    // Older callers may still pass a bare string; treat it as [value].
    expect(applyListFilters(items, { ...emptyFilters(), type: 'ABC' })).toHaveLength(2)
  })
})

describe('hasActiveFilters', () => {
  it('false for empty filters', () => {
    expect(hasActiveFilters(emptyFilters())).toBe(false)
  })
  it('true when any field has a selection or search is set', () => {
    expect(hasActiveFilters({ ...emptyFilters(), region: ['North'] })).toBe(true)
    expect(hasActiveFilters({ ...emptyFilters(), search: 'x' })).toBe(true)
  })
})
