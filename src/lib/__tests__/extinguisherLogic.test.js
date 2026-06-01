import { describe, it, expect } from 'vitest'
import {
  deriveStatus, isToBeRefilled, isInProcess, isPhysicalDefect, isRefilledClosed,
  isHealthy, severityLabel, fleetSummary, isDeleted, hasQuotation, needsQuotation,
} from '../extinguisherLogic'
import { STATUS } from '../constants'

const TODAY = new Date('2026-06-01')
const day = (n) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
// A healthy unit: far-out dates, no defects, active.
const healthy = (over = {}) => ({
  status: STATUS.ACTIVE,
  dateOfNextRefill: day(365),
  dateOfNextHPT: day(900),
  physicalDefects: [],
  ...over,
})

describe('deriveStatus due-date flags (n-30 boundaries)', () => {
  it('flags refill due-soon within 30 days but not at 31', () => {
    expect(deriveStatus(healthy({ dateOfNextRefill: day(30) }), TODAY).flags.REFILL_DUE_30).toBe(true)
    expect(deriveStatus(healthy({ dateOfNextRefill: day(31) }), TODAY).flags.REFILL_DUE_30).toBe(false)
  })
  it('flags refill overdue at/under 0 days', () => {
    expect(deriveStatus(healthy({ dateOfNextRefill: day(0) }), TODAY).flags.REFILL_DUE).toBe(true)
    expect(deriveStatus(healthy({ dateOfNextRefill: day(-5) }), TODAY).flags.REFILL_DUE).toBe(true)
  })
  it('flags HPT due-soon + overdue independently', () => {
    expect(deriveStatus(healthy({ dateOfNextHPT: day(10) }), TODAY).flags.HPT_DUE_30).toBe(true)
    expect(deriveStatus(healthy({ dateOfNextHPT: day(-1) }), TODAY).flags.HPT_DUE).toBe(true)
  })
})

describe('list membership', () => {
  it('healthy unit is healthy and in no work list', () => {
    const e = healthy()
    expect(isHealthy(e, TODAY)).toBe(true)
    expect(isToBeRefilled(e, TODAY)).toBe(false)
    expect(isPhysicalDefect(e)).toBe(false)
  })
  it('refill-due-soon unit lands in To Be Refilled', () => {
    expect(isToBeRefilled(healthy({ dateOfNextRefill: day(20) }), TODAY)).toBe(true)
  })
  it('empty defect → To Be Refilled (refill defect), not physical', () => {
    const e = healthy({ physicalDefects: ['empty'] })
    expect(isToBeRefilled(e, TODAY)).toBe(true)
    expect(isPhysicalDefect(e)).toBe(false)
  })
  it('hose-pipe defect → Physical Defects, not refill', () => {
    const e = healthy({ physicalDefects: ['hose_pipe'] })
    expect(isPhysicalDefect(e)).toBe(true)
    expect(isToBeRefilled(e, TODAY)).toBe(false)
  })
  it('in-process status is detected', () => {
    expect(isInProcess(healthy({ status: STATUS.IN_PROCESS_REFILLING }))).toBe(true)
  })
})

describe('isRefilledClosed (the recent fix)', () => {
  it('true when lastRefilledAt is stamped, even though status is active', () => {
    expect(isRefilledClosed(healthy({ lastRefilledAt: '2026-05-31' }))).toBe(true)
  })
  it('true for legacy CLOSED status', () => {
    expect(isRefilledClosed({ status: STATUS.CLOSED })).toBe(true)
  })
  it('false for a fresh never-refilled unit', () => {
    expect(isRefilledClosed(healthy())).toBe(false)
  })
})

describe('severityLabel', () => {
  it('prioritizes refill defect over due-soon', () => {
    expect(severityLabel(healthy({ physicalDefects: ['empty'] }), TODAY)).toBe('Empty')
  })
  it('healthy unit reads Healthy', () => {
    expect(severityLabel(healthy(), TODAY)).toBe('Healthy')
  })
})

describe('fleetSummary', () => {
  it('counts healthy / to-be-refilled / refilled-closed correctly', () => {
    const list = [
      healthy(),
      healthy({ dateOfNextRefill: day(10) }),       // to be refilled
      healthy({ lastRefilledAt: '2026-05-31' }),    // refilled & closed (still active)
    ]
    const s = fleetSummary(list, TODAY)
    expect(s.total).toBe(3)
    expect(s.healthy).toBe(2) // healthy() + the refilled one (active, far dates, no defects)
    expect(s.toBeRefilled).toBe(1)
    expect(s.closed).toBe(1)
  })
  it('excludes soft-deleted units from total and all counts', () => {
    const list = [healthy(), healthy({ deletedAt: '2026-05-30', dateOfNextRefill: day(5) })]
    const s = fleetSummary(list, TODAY)
    expect(s.total).toBe(1)        // deleted one not counted
    expect(s.toBeRefilled).toBe(0) // its due-soon date ignored
    expect(s.healthy).toBe(1)
  })
})

describe('quotation gate', () => {
  const quote = { amount: 1200, vendor: 'Acme', submittedAt: '2026-05-30' }
  it('hasQuotation reflects a submitted quotation', () => {
    expect(hasQuotation(healthy())).toBe(false)
    expect(hasQuotation(healthy({ quotation: null }))).toBe(false)
    expect(hasQuotation(healthy({ quotation: { amount: 0 } }))).toBe(false) // no submittedAt
    expect(hasQuotation(healthy({ quotation: quote }))).toBe(true)
  })
  it('needsQuotation: refill-due item with no quote needs one', () => {
    const e = healthy({ dateOfNextRefill: day(10) })
    expect(needsQuotation(e, TODAY)).toBe(true)
  })
  it('needsQuotation: physical-defect item with no quote needs one', () => {
    expect(needsQuotation(healthy({ physicalDefects: ['hose_pipe'] }), TODAY)).toBe(true)
  })
  it('needsQuotation: false once a quotation is present', () => {
    const e = healthy({ dateOfNextRefill: day(10), quotation: quote })
    expect(needsQuotation(e, TODAY)).toBe(false)
  })
  it('needsQuotation: false for a healthy item', () => {
    expect(needsQuotation(healthy(), TODAY)).toBe(false)
  })
})

describe('isDeleted', () => {
  it('true only when deletedAt is set', () => {
    expect(isDeleted({ deletedAt: '2026-05-30' })).toBe(true)
    expect(isDeleted(healthy())).toBe(false)
    expect(isDeleted({ deletedAt: null })).toBe(false)
  })
  it('treats a doc with an ABSENT deletedAt field as active (not deleted)', () => {
    // Pre-soft-delete docs have no deletedAt at all — must still count as active.
    const legacy = { status: STATUS.ACTIVE } // no deletedAt key
    expect(isDeleted(legacy)).toBe(false)
  })
})
