import { describe, it, expect } from 'vitest'
import { answer, suggestedQuestions, pageGuide, buildAIContext } from '../assistant'

// Minimal fleet context shaped like FleetContext's exported value.
const ctx = (over = {}) => ({
  extinguishers: [
    { id: '1', serialNo: 'FE-0001', type: 'ABC', capacity: '6 Kg', entity: '1P', region: 'North', centerName: 'Alpha', status: 'active' },
    { id: '2', serialNo: 'FE-0002', type: 'CO2', capacity: '5 Kg', entity: '2P', region: 'South', centerName: 'Beta', status: 'to_be_refilled' },
  ],
  refillDue: [{ id: '2', serialNo: 'FE-0002', region: 'South', centerName: 'Beta' }],
  inProcess: [],
  physicalDefects: [],
  closed: [],
  physicalOpen: [],
  pendingReports: [],
  summary: { total: 2, healthy: 1 },
  pathname: '/app/dashboard',
  ...over,
})

describe('answer — fleet intents', () => {
  it('summary reports counts', () => {
    const r = answer('give me a summary', ctx())
    expect(r.matched).toBe(true)
    expect(r.text).toMatch(/2 extinguisher/)
  })
  it('refill-due intent lists due units', () => {
    const r = answer('how many are due for refill?', ctx())
    expect(r.matched).toBe(true)
    expect(r.text).toMatch(/1 extinguisher/)
  })
  it('what needs attention surfaces refill + pending', () => {
    const r = answer('what needs attention?', ctx({ pendingReports: [{ id: 'p1' }] }))
    expect(r.matched).toBe(true)
    expect(r.text.toLowerCase()).toMatch(/refill|approval|quotation/)
  })
  it('region lookup works', () => {
    const r = answer('extinguishers in North', ctx())
    expect(r.matched).toBe(true)
    expect(r.text).toMatch(/North/)
  })
  it('breakdown by type', () => {
    const r = answer('what types do we have?', ctx())
    expect(r.text).toMatch(/ABC/)
    expect(r.text).toMatch(/CO2/)
  })
})

describe('answer — navigation + guidance', () => {
  it('add extinguisher navigates', () => {
    const r = answer('add a new extinguisher', ctx())
    expect(r.action?.type).toBe('navigate')
    expect(r.action.to).toBe('/app/add')
  })
  it('electrical-fire guidance cites HSE and CO2', () => {
    const r = answer('which extinguisher for an electrical fire?', ctx())
    expect(r.matched).toBe(true)
    expect(r.text).toMatch(/CO₂|CO2/)
    expect(r.text).toMatch(/hse\.gov\.uk/)
  })
  it('PASS technique guidance', () => {
    const r = answer('how do i use an extinguisher?', ctx())
    expect(r.text).toMatch(/Pull|Aim|Squeeze|Sweep/)
  })
  it('unmatched safety-ish question defers to AI (matched=false)', () => {
    const r = answer('tell me something obscure about foam chemistry xyz', ctx())
    expect(r.matched).toBe(false)
  })
})

describe('page helpers', () => {
  it('suggestedQuestions returns up to 5', () => {
    expect(suggestedQuestions('/app/repository').length).toBeLessThanOrEqual(5)
  })
  it('pageGuide resolves a known page', () => {
    expect(pageGuide('/app/refill-due').title).toBe('To Be Refilled')
  })
  it('buildAIContext exposes totals + breakdowns', () => {
    const c = buildAIContext(ctx())
    expect(c.totals.extinguishers).toBe(2)
    expect(c.byType.length).toBe(2)
  })
})
