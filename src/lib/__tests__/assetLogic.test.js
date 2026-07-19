import { describe, it, expect } from 'vitest'
import { aedIncomplete, aedSummary, fasIncomplete, fasSummary } from '../assetLogic'
import { AED_STATUS, FAS_STATUS } from '../constants'

describe('aedIncomplete', () => {
  it('flags a record missing the site', () => {
    expect(aedIncomplete({ batteryExpiry: '2027-01-01', padExpiry: '2027-01-01' })).toBe(true)
  })
  it('flags a record missing battery or pad expiry', () => {
    expect(aedIncomplete({ centerName: 'A', padExpiry: '2027-01-01' })).toBe(true)
    expect(aedIncomplete({ centerName: 'A', batteryExpiry: '2027-01-01' })).toBe(true)
  })
  it('is complete when site + both expiries are present', () => {
    expect(aedIncomplete({ centerName: 'A', batteryExpiry: '2027-01-01', padExpiry: '2027-01-01' })).toBe(false)
  })
  it('handles null/undefined without throwing', () => {
    expect(aedIncomplete(null)).toBe(true)
    expect(aedIncomplete(undefined)).toBe(true)
  })
})

describe('fasIncomplete', () => {
  it('flags a record missing the site', () => {
    expect(fasIncomplete({ deviceType: 'Control Panel' })).toBe(true)
  })
  it('is complete once a site is set (no extra details required)', () => {
    expect(fasIncomplete({ centerName: 'Tower B' })).toBe(false)
  })
})

describe('summary incomplete counts', () => {
  it('counts incomplete AEDs', () => {
    const list = [
      { status: AED_STATUS.READY, centerName: 'A', batteryExpiry: '2099-01-01', padExpiry: '2099-01-01' },
      { status: AED_STATUS.READY, centerName: 'B' }, // incomplete
      { status: AED_STATUS.READY }, // incomplete
    ]
    expect(aedSummary(list).incomplete).toBe(2)
  })
  it('counts incomplete FAS devices', () => {
    const list = [
      { status: FAS_STATUS.OPERATIONAL, centerName: 'A' },
      { status: FAS_STATUS.OPERATIONAL }, // incomplete
    ]
    expect(fasSummary(list).incomplete).toBe(1)
  })
})
