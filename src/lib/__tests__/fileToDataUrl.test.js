import { describe, it, expect } from 'vitest'
import { validateQuoteFile, isAcceptedQuoteType, MAX_QUOTE_FILE_BYTES } from '../fileToDataUrl'

describe('isAcceptedQuoteType', () => {
  it('accepts PDF and any image, rejects others', () => {
    expect(isAcceptedQuoteType('application/pdf')).toBe(true)
    expect(isAcceptedQuoteType('image/png')).toBe(true)
    expect(isAcceptedQuoteType('image/jpeg')).toBe(true)
    expect(isAcceptedQuoteType('text/plain')).toBe(false)
    expect(isAcceptedQuoteType('application/zip')).toBe(false)
    expect(isAcceptedQuoteType('')).toBe(false)
  })
})

describe('validateQuoteFile', () => {
  it('returns null for a valid small PDF', () => {
    expect(validateQuoteFile({ type: 'application/pdf', size: 100 * 1024 })).toBeNull()
  })
  it('rejects a disallowed type', () => {
    expect(validateQuoteFile({ type: 'text/csv', size: 1000 })).toMatch(/PDF or image/)
  })
  it('rejects an oversized file', () => {
    expect(validateQuoteFile({ type: 'image/png', size: MAX_QUOTE_FILE_BYTES + 1 })).toMatch(/too large/)
  })
  it('rejects a missing file', () => {
    expect(validateQuoteFile(null)).toMatch(/No file/)
  })
  it('accepts a file exactly at the limit', () => {
    expect(validateQuoteFile({ type: 'image/jpeg', size: MAX_QUOTE_FILE_BYTES })).toBeNull()
  })
})
