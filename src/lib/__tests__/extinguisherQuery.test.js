import { describe, it, expect } from 'vitest'
import { buildExtinguisherConstraints, hasServerFilters, FILTER_ALL } from '../extinguisherQuery'

describe('buildExtinguisherConstraints', () => {
  it('always excludes soft-deleted', () => {
    const c = buildExtinguisherConstraints({})
    expect(c).toEqual([{ field: 'deletedAt', op: '==', value: null }])
  })

  it('adds equality constraints for active stored filters only', () => {
    const c = buildExtinguisherConstraints({ type: 'ABC', region: FILTER_ALL, status: 'active' })
    expect(c).toEqual([
      { field: 'deletedAt', op: '==', value: null },
      { field: 'type', op: '==', value: 'ABC' },
      { field: 'status', op: '==', value: 'active' },
    ])
  })

  it('ignores FILTER_ALL / empty values', () => {
    const c = buildExtinguisherConstraints({ type: FILTER_ALL, capacity: '', entity: undefined })
    expect(c).toHaveLength(1)
  })

  it('is deterministic in field order', () => {
    const c = buildExtinguisherConstraints({ status: 'closed', type: 'CO2', entity: '1P' })
    expect(c.map((x) => x.field)).toEqual(['deletedAt', 'type', 'entity', 'status'])
  })
})

describe('hasServerFilters', () => {
  it('false when nothing active', () => {
    expect(hasServerFilters({ type: FILTER_ALL })).toBe(false)
    expect(hasServerFilters({})).toBe(false)
  })
  it('true when any stored filter set', () => {
    expect(hasServerFilters({ region: 'North' })).toBe(true)
  })
})
