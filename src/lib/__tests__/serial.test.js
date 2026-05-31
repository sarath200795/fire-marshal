import { describe, it, expect } from 'vitest'
import { nextSerial, assignSerials } from '../serial'

describe('nextSerial', () => {
  it('starts at FE-0001 for an empty list', () => {
    expect(nextSerial([])).toBe('FE-0001')
  })
  it('continues after the highest FE-#### and ignores non-FE serials', () => {
    expect(nextSerial(['FE-0001', 'FE-0007', 'ABC', 'FE-0003'])).toBe('FE-0008')
  })
  it('zero-pads to 4 digits', () => {
    expect(nextSerial(['FE-0099'])).toBe('FE-0100')
  })
})

describe('assignSerials', () => {
  it('fills blanks sequentially without colliding and preserves custom serials', () => {
    const rows = [{ serialNo: '' }, { serialNo: 'CUSTOM-1' }, { serialNo: '' }, { serialNo: '' }]
    const out = assignSerials(rows, ['FE-0009'])
    expect(out.map((r) => r.serialNo)).toEqual(['FE-0010', 'CUSTOM-1', 'FE-0011', 'FE-0012'])
  })
  it('does not mutate the input rows', () => {
    const rows = [{ serialNo: '' }]
    assignSerials(rows, [])
    expect(rows[0].serialNo).toBe('')
  })
})
