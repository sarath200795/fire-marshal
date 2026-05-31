import { describe, it, expect } from 'vitest'
import { diffSummary, auditMeta, AUDIT } from '../audit'

describe('diffSummary', () => {
  it('reports changed tracked fields as old → new', () => {
    const before = { region: 'North', centerName: 'Tower A', status: 'active' }
    const after = { region: 'South', centerName: 'Tower A' }
    expect(diffSummary(before, after)).toBe('region: North → South')
  })
  it('shows em-dash for empty values', () => {
    expect(diffSummary({ serialNo: '' }, { serialNo: 'FE-0001' })).toBe('serialNo: — → FE-0001')
  })
  it('summarizes physicalDefects array changes', () => {
    const s = diffSummary({ physicalDefects: ['pin'] }, { physicalDefects: [] })
    expect(s).toBe('defects: pin → none')
  })
  it('returns empty string when nothing tracked changed', () => {
    expect(diffSummary({ type: 'ABC' }, { type: 'ABC' })).toBe('')
    expect(diffSummary({ type: 'ABC' }, { updatedAt: 'x' })).toBe('')
  })
})

describe('auditMeta', () => {
  it('maps a known action to a label + color', () => {
    const m = auditMeta(AUDIT.EXT_CREATE)
    expect(m.label).toBe('Added extinguisher')
    expect(m.color).toMatch(/^#/)
  })
  it('falls back gracefully for unknown actions', () => {
    expect(auditMeta('weird.thing').label).toBe('weird.thing')
  })
})
