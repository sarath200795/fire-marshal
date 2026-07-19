import { describe, it, expect } from 'vitest'
import { aedIncomplete, aedSummary, fasIncomplete, fasSummary, nextAssetId, highestAssetSeq, formatAssetId } from '../assetLogic'
import { AED_STATUS, FAS_STATUS } from '../constants'

describe('unique asset IDs', () => {
  it('starts at 0001 for an empty list', () => {
    expect(nextAssetId('AED', [], 'assetId')).toBe('AED-0001')
  })
  it('increments past the highest existing suffix', () => {
    const list = [{ assetId: 'AED-0001' }, { assetId: 'AED-0007' }, { assetId: 'AED-0003' }]
    expect(nextAssetId('AED', list, 'assetId')).toBe('AED-0008')
  })
  it('ignores non-matching / legacy free-text ids', () => {
    const list = [{ assetId: 'old-unit' }, { assetId: 'AED-0002' }, { assetId: '' }, {}]
    expect(highestAssetSeq('AED', list, 'assetId')).toBe(2)
    expect(nextAssetId('AED', list, 'assetId')).toBe('AED-0003')
  })
  it('keeps prefixes separate', () => {
    const fas = [{ deviceId: 'FAS-0005' }]
    expect(nextAssetId('FAS', fas, 'deviceId')).toBe('FAS-0006')
    expect(formatAssetId('FAS', 12)).toBe('FAS-0012')
  })
})

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
