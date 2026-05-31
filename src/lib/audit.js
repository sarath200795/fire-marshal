// ─────────────────────────────────────────────────────────────────────────────
// Audit-log action constants + pure helpers (no Firestore here, so they're
// unit-testable). The Firestore write itself lives in firestore.js (logAudit).
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIT = {
  EXT_CREATE: 'extinguisher.create',
  EXT_UPDATE: 'extinguisher.update',
  EXT_DELETE: 'extinguisher.delete',
  EXT_BULK_CREATE: 'extinguisher.bulkCreate',
  EXT_BULK_UPSERT: 'extinguisher.bulkUpsert',
  EXT_BULK_DELETE: 'extinguisher.bulkDelete',
  WF_SENT_TO_VENDOR: 'workflow.sentToVendor',
  WF_REFILLED_CLOSED: 'workflow.refilledClosed',
  WF_RESOLVED_DEFECTS: 'workflow.resolvedDefects',
  REPORT_CREATE: 'report.create',
  REPORT_APPROVE: 'report.approve',
  REPORT_REJECT: 'report.reject',
  USER_STATUS: 'user.status',
  USER_ROLE: 'user.role',
  ORG_SETTINGS: 'org.settings',
}

// Human label + color for each action (used by the audit table badge).
export const AUDIT_META = {
  [AUDIT.EXT_CREATE]: { label: 'Added extinguisher', color: '#16a34a' },
  [AUDIT.EXT_UPDATE]: { label: 'Edited extinguisher', color: '#6366f1' },
  [AUDIT.EXT_DELETE]: { label: 'Deleted extinguisher', color: '#dc2626' },
  [AUDIT.EXT_BULK_CREATE]: { label: 'Bulk added', color: '#16a34a' },
  [AUDIT.EXT_BULK_UPSERT]: { label: 'Bulk imported', color: '#0891b2' },
  [AUDIT.EXT_BULK_DELETE]: { label: 'Bulk deleted', color: '#dc2626' },
  [AUDIT.WF_SENT_TO_VENDOR]: { label: 'Sent to vendor', color: '#f59e0b' },
  [AUDIT.WF_REFILLED_CLOSED]: { label: 'Refilled & closed', color: '#0ea5e9' },
  [AUDIT.WF_RESOLVED_DEFECTS]: { label: 'Resolved defects', color: '#16a34a' },
  [AUDIT.REPORT_CREATE]: { label: 'Report submitted', color: '#a855f7' },
  [AUDIT.REPORT_APPROVE]: { label: 'Report approved', color: '#16a34a' },
  [AUDIT.REPORT_REJECT]: { label: 'Report rejected', color: '#dc2626' },
  [AUDIT.USER_STATUS]: { label: 'User status', color: '#f59e0b' },
  [AUDIT.USER_ROLE]: { label: 'User role', color: '#6366f1' },
  [AUDIT.ORG_SETTINGS]: { label: 'Org settings', color: '#64748b' },
}

export function auditMeta(action) {
  return AUDIT_META[action] || { label: action || 'Change', color: '#64748b' }
}

// Fields we report old→new changes for on an extinguisher edit.
const TRACKED_FIELDS = [
  'serialNo', 'type', 'capacity', 'entity', 'region', 'centerName',
  'dateOfDeployment', 'dateOfNextRefill', 'dateOfNextHPT', 'status',
]

function norm(v) {
  if (Array.isArray(v)) return v.join(', ')
  if (v === undefined || v === null) return ''
  return String(v)
}

/**
 * Build a concise "field: old → new" summary string from a before/after pair.
 * Pure + deterministic so it can be unit-tested. `after` may be a partial
 * (only changed keys); we compare each tracked field present in `after`.
 */
export function diffSummary(before = {}, after = {}) {
  const parts = []
  const keys = TRACKED_FIELDS.filter((k) => k in after)
  // physicalDefects handled separately (array)
  for (const k of keys) {
    const a = norm(before[k])
    const b = norm(after[k])
    if (a !== b) parts.push(`${k}: ${a || '—'} → ${b || '—'}`)
  }
  if ('physicalDefects' in after) {
    const a = norm(before.physicalDefects)
    const b = norm(after.physicalDefects)
    if (a !== b) parts.push(`defects: ${a || 'none'} → ${b || 'none'}`)
  }
  return parts.join('; ')
}
