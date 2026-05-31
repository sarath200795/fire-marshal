import { describe, it, expect } from 'vitest'
import { derivePhysicalDefectLog } from '../defectReports'

const approvedReport = (extId, defectType) => ({
  id: `r-${extId}-${defectType}`,
  approvalStatus: 'approved',
  kind: 'defect',
  defectType,
  extId,
  extLabel: `${extId} · ABC`,
})

describe('derivePhysicalDefectLog', () => {
  it('puts a still-active physical defect in OPEN', () => {
    const reports = [approvedReport('e1', 'hose_pipe')]
    const exts = [{ id: 'e1', serialNo: 'FE-1', type: 'ABC', physicalDefects: ['hose_pipe'] }]
    const { open, closed } = derivePhysicalDefectLog(reports, exts)
    expect(open).toHaveLength(1)
    expect(closed).toHaveLength(0)
    expect(open[0].defectType).toBe('hose_pipe')
  })

  it('puts a resolved physical defect in CLOSED', () => {
    const reports = [approvedReport('e1', 'hose_pipe')]
    const exts = [{ id: 'e1', serialNo: 'FE-1', type: 'ABC', physicalDefects: [] }]
    const { open, closed } = derivePhysicalDefectLog(reports, exts)
    expect(open).toHaveLength(0)
    expect(closed).toHaveLength(1)
  })

  it('treats a deleted extinguisher as CLOSED', () => {
    const reports = [approvedReport('gone', 'pin')]
    const { open, closed } = derivePhysicalDefectLog(reports, [])
    expect(open).toHaveLength(0)
    expect(closed).toHaveLength(1)
    expect(closed[0].deleted).toBe(true)
  })

  it('ignores pending reports and refill-type defects', () => {
    const reports = [
      { id: 'p', approvalStatus: 'pending', kind: 'defect', defectType: 'pin', extId: 'e1' },
      approvedReport('e1', 'empty'), // refill defect, not physical
    ]
    const exts = [{ id: 'e1', physicalDefects: ['pin', 'empty'] }]
    const { open, closed } = derivePhysicalDefectLog(reports, exts)
    expect(open).toHaveLength(0)
    expect(closed).toHaveLength(0)
  })
})
