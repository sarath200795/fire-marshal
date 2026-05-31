// ─────────────────────────────────────────────────────────────────────────────
// All Firestore access goes through here: org-scoped paths, batch helpers, and
// the public QR mirror kept in sync with every extinguisher write.
// ─────────────────────────────────────────────────────────────────────────────
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  limit,
  startAfter,
} from 'firebase/firestore'
import { db } from '../firebase'
import { generateQrToken } from './qr'
import { STATUS, REFILL_DEFECT_KEYS } from './constants'
import { AUDIT, diffSummary } from './audit'
import { buildExtinguisherConstraints } from './extinguisherQuery'

// ── Path helpers ─────────────────────────────────────────────────────────────
const orgRef = (orgId) => doc(db, 'organizations', orgId)
const extCol = (orgId) => collection(db, 'organizations', orgId, 'extinguishers')
const extRef = (orgId, id) => doc(db, 'organizations', orgId, 'extinguishers', id)
const reportCol = (orgId) => collection(db, 'organizations', orgId, 'reports')
const reportRef = (orgId, id) => doc(db, 'organizations', orgId, 'reports', id)
const userRef = (uid) => doc(db, 'users', uid)
const qrRef = (token) => doc(db, 'qr', token)
const auditCol = (orgId) => collection(db, 'organizations', orgId, 'auditLogs')
// Public, minimal name→org index so signup can look up an org by name WITHOUT
// reading the (member-only) organizations collection.
const orgIndexKey = (name) => (name || '').trim().toLowerCase()
const orgIndexRef = (name) => doc(db, 'orgIndex', orgIndexKey(name))

// ── Audit log ──────────────────────────────────────────────────────────────────
// Append-only trail. Never let an audit failure break the primary write.
async function logAudit(orgId, actor, action, details = {}) {
  if (!orgId) return
  try {
    await addDoc(auditCol(orgId), {
      at: serverTimestamp(),
      actorUid: actor?.uid || null,
      actorName: actor?.name || 'Unknown',
      action,
      target: details.target || 'extinguisher',
      targetId: details.targetId || null,
      targetLabel: details.targetLabel || '',
      summary: details.summary || '',
      source: details.source || 'portal',
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Fire Marshal] audit log failed:', e?.message || e)
  }
}

export function subscribeAuditLogs(orgId, cb) {
  const q = query(auditCol(orgId), orderBy('at', 'desc'), limit(200))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

// ── Stats counters (organizations/{orgId}/meta/stats) ────────────────────────
// Maintained atomically inside each mutation batch so the dashboard's structural
// totals are exact fleet-wide regardless of the 2,000 load cap.

// Turn a sparse delta object (from statsDeltaFor) into increment() field updates,
// flattened to dotted paths (e.g. "byStatus.active"). Adds them to an open batch.
function applyStatsDelta(batch, orgId, delta) {
  if (!delta) return
  const fields = {}
  if (delta.total) fields.total = increment(delta.total)
  for (const bucket of ['byStatus', 'byType', 'byEntity', 'byRegion']) {
    const m = delta[bucket]
    if (!m) continue
    for (const k of Object.keys(m)) {
      if (m[k]) fields[`${bucket}.${k}`] = increment(m[k])
    }
  }
  if (Object.keys(fields).length === 0) return
  fields.updatedAt = serverTimestamp()
  // set(merge) so the doc is created on first write and increments thereafter.
  batch.set(statsRef(orgId), fields, { merge: true })
}

export function subscribeStats(orgId, cb) {
  return onSnapshot(statsRef(orgId), (snap) => cb(snap.exists() ? snap.data() : null))
}

/** Full recompute from a one-time read of all extinguishers (admin Refresh / backfill). */
export async function recomputeStats(orgId) {
  const snap = await getDocs(extCol(orgId))
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const s = accumulate(list)
  await setDoc(statsRef(orgId), { ...s, updatedAt: serverTimestamp() })
  return s
}

const extLabelOf = (ext) =>
  ext?.serialNo ? `${ext.serialNo} · ${ext.type || ''}`.trim() : `${ext?.type || ''} · ${ext?.capacity || ''}`

// ── Organizations & users ─────────────────────────────────────────────────────

/** Create an org + its first admin user + public name index, atomically. */
export async function createOrganization({ orgName, address, uid, name, email }) {
  const org = doc(collection(db, 'organizations'))
  const batch = writeBatch(db)
  batch.set(org, {
    name: orgName,
    nameLower: orgName.trim().toLowerCase(),
    address: address || '',
    createdBy: uid,
    notificationEmail: email, // default: admin's email (editable later)
    createdAt: serverTimestamp(),
  })
  batch.set(userRef(uid), {
    name,
    email,
    orgId: org.id,
    orgName,
    role: 'admin',
    status: 'approved',
    createdAt: serverTimestamp(),
  })
  // Public lookup index (no sensitive fields) so signup can resolve org-by-name
  // without read access to the organizations collection.
  batch.set(orgIndexRef(orgName), { orgId: org.id, name: orgName })
  await batch.commit()
  return org.id
}

/**
 * Find an organization by exact (case-insensitive) name via the public
 * orgIndex. Returns { id, name } or null. (Only the fields needed at signup.)
 */
export async function findOrgByName(orgName) {
  const snap = await getDoc(orgIndexRef(orgName))
  if (!snap.exists()) return null
  const d = snap.data()
  return { id: d.orgId, name: d.name }
}

/** Create a pending member who is joining an existing org. */
export async function createPendingMember({ uid, name, email, orgId, orgName }) {
  await setDoc(userRef(uid), {
    name,
    email,
    orgId,
    orgName,
    role: 'member',
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

export async function getUserProfile(uid) {
  const snap = await getDoc(userRef(uid))
  return snap.exists() ? { uid, ...snap.data() } : null
}

export function subscribeOrgUsers(orgId, cb) {
  const q = query(collection(db, 'users'), where('orgId', '==', orgId))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))))
}

/** Live org document. */
export function subscribeOrg(orgId, cb) {
  return onSnapshot(orgRef(orgId), (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null))
}

/** Admin updates org-level settings. */
export async function updateOrgSettings(orgId, updates, actor) {
  await updateDoc(orgRef(orgId), updates)
  await logAudit(orgId, actor, AUDIT.ORG_SETTINGS, {
    target: 'org',
    summary: `Updated org settings: ${Object.keys(updates).join(', ')}`,
  })
}

export async function setUserStatus(uid, status, orgId, actor, userLabel) {
  await updateDoc(userRef(uid), { status })
  await logAudit(orgId, actor, AUDIT.USER_STATUS, {
    target: 'user',
    targetId: uid,
    targetLabel: userLabel || uid,
    summary: `Set status → ${status}`,
  })
}

export async function setUserRole(uid, role, orgId, actor, userLabel) {
  await updateDoc(userRef(uid), { role })
  await logAudit(orgId, actor, AUDIT.USER_ROLE, {
    target: 'user',
    targetId: uid,
    targetLabel: userLabel || uid,
    summary: `Set role → ${role}`,
  })
}

// ── QR mirror ──────────────────────────────────────────────────────────────────
// Minimal public-readable copy of an extinguisher, keyed by qrToken.
function mirrorPayload(orgId, orgName, id, ext) {
  return {
    orgId,
    orgName: orgName || '',
    extId: id,
    token: ext.qrToken,
    serialNo: ext.serialNo || '',
    type: ext.type,
    capacity: ext.capacity,
    entity: ext.entity,
    region: ext.region || '',
    centerName: ext.centerName,
    dateOfDeployment: ext.dateOfDeployment || '',
    dateOfNextRefill: ext.dateOfNextRefill || '',
    dateOfNextHPT: ext.dateOfNextHPT || '',
    status: ext.status,
    physicalDefects: ext.physicalDefects || [],
    updatedAt: serverTimestamp(),
  }
}

// ── Extinguishers ──────────────────────────────────────────────────────────────

/** Add a single extinguisher + its public QR mirror. Returns {id, qrToken}. */
export async function addExtinguisher(orgId, orgName, data, actor) {
  const ref = doc(extCol(orgId))
  const qrToken = generateQrToken()
  const ext = {
    serialNo: data.serialNo || '',
    type: data.type,
    capacity: data.capacity,
    entity: data.entity,
    region: data.region || '',
    centerName: data.centerName,
    dateOfDeployment: data.dateOfDeployment || '',
    dateOfNextRefill: data.dateOfNextRefill || '',
    dateOfNextHPT: data.dateOfNextHPT || '',
    status: STATUS.ACTIVE,
    physicalDefects: [],
    qrToken,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const batch = writeBatch(db)
  batch.set(ref, ext)
  batch.set(qrRef(qrToken), mirrorPayload(orgId, orgName, ref.id, ext))
  applyStatsDelta(batch, orgId, statsDeltaFor(null, ext))
  await batch.commit()
  await logAudit(orgId, actor, AUDIT.EXT_CREATE, {
    targetId: ref.id,
    targetLabel: extLabelOf(ext),
    summary: `${ext.type} ${ext.capacity} @ ${ext.centerName}`,
  })
  return { id: ref.id, qrToken }
}

/** Bulk add many extinguishers in chunked batches. Returns count written. */
export async function bulkAddExtinguishers(orgId, orgName, rows, actor) {
  let written = 0
  // Firestore batches max 500 ops; each row = 2 writes, so chunk by 200 rows.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const batch = writeBatch(db)
    const created = []
    for (const data of chunk) {
      const ref = doc(extCol(orgId))
      const qrToken = generateQrToken()
      const ext = {
        serialNo: data.serialNo || '',
        type: data.type,
        capacity: data.capacity,
        entity: data.entity,
        region: data.region || '',
        centerName: data.centerName,
        dateOfDeployment: data.dateOfDeployment || '',
        dateOfNextRefill: data.dateOfNextRefill || '',
        dateOfNextHPT: data.dateOfNextHPT || '',
        status: STATUS.ACTIVE,
        physicalDefects: [],
        qrToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      batch.set(ref, ext)
      batch.set(qrRef(qrToken), mirrorPayload(orgId, orgName, ref.id, ext))
      created.push(ext)
      written++
    }
    // One stats write per batch (all creates = accumulate of the chunk).
    applyStatsDelta(batch, orgId, accumulate(created))
    await batch.commit()
  }
  await logAudit(orgId, actor, AUDIT.EXT_BULK_CREATE, {
    summary: `${written} extinguisher(s) added via bulk upload`,
  })
  return written
}

// Spec/date fields safe to overwrite on a CSV upsert (NOT status/defects/qrToken).
const UPSERT_FIELDS = [
  'type',
  'capacity',
  'entity',
  'region',
  'centerName',
  'serialNo',
  'dateOfDeployment',
  'dateOfNextRefill',
  'dateOfNextHPT',
]

/**
 * Bulk create + update from a CSV import.
 *  - creates: new extinguisher rows (each gets a fresh qrToken + mirror).
 *  - updates: [{ id, qrToken, ...data }] — overwrites spec/date fields only,
 *    preserving status, physicalDefects and the existing qrToken; mirror rewritten.
 * Returns { created, updated } counts.
 */
export async function bulkUpsertExtinguishers(orgId, orgName, { creates = [], updates = [] }, actor) {
  let created = 0
  let updated = 0

  // ── Creates (chunked: 2 writes each) ──
  for (let i = 0; i < creates.length; i += 200) {
    const chunk = creates.slice(i, i + 200)
    const batch = writeBatch(db)
    for (const data of chunk) {
      const ref = doc(extCol(orgId))
      const qrToken = generateQrToken()
      const ext = {
        serialNo: data.serialNo || '',
        type: data.type,
        capacity: data.capacity,
        entity: data.entity,
        region: data.region || '',
        centerName: data.centerName,
        dateOfDeployment: data.dateOfDeployment || '',
        dateOfNextRefill: data.dateOfNextRefill || '',
        dateOfNextHPT: data.dateOfNextHPT || '',
        status: STATUS.ACTIVE,
        physicalDefects: [],
        qrToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      batch.set(ref, ext)
      batch.set(qrRef(qrToken), mirrorPayload(orgId, orgName, ref.id, ext))
      created++
    }
    await batch.commit()
  }

  // ── Updates (spec/date only; keep status/defects/qrToken) ──
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200)
    const batch = writeBatch(db)
    for (const row of chunk) {
      const fields = {}
      for (const k of UPSERT_FIELDS) {
        if (row[k] !== undefined) fields[k] = row[k] || ''
      }
      fields.updatedAt = serverTimestamp()
      batch.update(extRef(orgId, row.id), fields)
      if (row.qrToken) {
        // Mirror needs the full picture; carry preserved status/defects too.
        const merged = {
          ...row,
          qrToken: row.qrToken,
          status: row.status,
          physicalDefects: row.physicalDefects || [],
        }
        batch.set(qrRef(row.qrToken), mirrorPayload(orgId, orgName, row.id, merged))
      }
      updated++
    }
    await batch.commit()
  }

  // Updates can shift type/entity/region buckets (and creates add rows); a full
  // recompute is the simplest correct way to reconcile both in one pass.
  await recomputeStats(orgId)
  await logAudit(orgId, actor, AUDIT.EXT_BULK_UPSERT, {
    summary: `Bulk import: ${created} added, ${updated} updated`,
  })
  return { created, updated }
}

/**
 * Update an extinguisher and keep its QR mirror in sync.
 * `opts` = { actor, action, summary } drives the audit entry. Defaults to a
 * field-level diff under the generic "edit" action.
 */
export async function updateExtinguisher(orgId, orgName, id, updates, opts = {}) {
  const current = await getDoc(extRef(orgId, id))
  if (!current.exists()) throw new Error('Extinguisher not found')
  const before = current.data()
  const merged = { ...before, ...updates }
  const batch = writeBatch(db)
  batch.update(extRef(orgId, id), { ...updates, updatedAt: serverTimestamp() })
  if (merged.qrToken) {
    batch.set(qrRef(merged.qrToken), mirrorPayload(orgId, orgName, id, merged))
  }
  applyStatsDelta(batch, orgId, statsDeltaFor(before, merged))
  await batch.commit()
  if (!opts.silent) {
    await logAudit(orgId, opts.actor, opts.action || AUDIT.EXT_UPDATE, {
      targetId: id,
      targetLabel: extLabelOf(merged),
      summary: opts.summary || diffSummary(before, updates),
    })
  }
}

/**
 * Soft-delete one extinguisher: mark deletedAt/deletedBy (recoverable from the
 * Recycle Bin) and remove the public QR mirror so scans stop resolving.
 */
export async function deleteExtinguisher(orgId, id, qrToken, actor, label) {
  const batch = writeBatch(db)
  batch.update(extRef(orgId, id), {
    deletedAt: serverTimestamp(),
    deletedBy: actor?.name || '',
  })
  if (qrToken) batch.delete(qrRef(qrToken))
  await batch.commit()
  await recomputeStats(orgId)
  await logAudit(orgId, actor, AUDIT.EXT_DELETE, { targetId: id, targetLabel: label || '' })
}

/** Bulk soft-delete extinguishers (+ remove mirrors) by [{id, qrToken}]. */
export async function bulkDeleteExtinguishers(orgId, items, actor) {
  for (let i = 0; i < items.length; i += 200) {
    const chunk = items.slice(i, i + 200)
    const batch = writeBatch(db)
    for (const { id, qrToken } of chunk) {
      batch.update(extRef(orgId, id), {
        deletedAt: serverTimestamp(),
        deletedBy: actor?.name || '',
      })
      if (qrToken) batch.delete(qrRef(qrToken))
    }
    await batch.commit()
  }
  await recomputeStats(orgId)
  await logAudit(orgId, actor, AUDIT.EXT_BULK_DELETE, {
    summary: `${items.length} extinguisher(s) deleted`,
  })
}

/** Restore a soft-deleted extinguisher: clear deletedAt + rebuild the QR mirror. */
export async function restoreExtinguisher(orgId, orgName, id, actor) {
  const snap = await getDoc(extRef(orgId, id))
  if (!snap.exists()) throw new Error('Extinguisher not found')
  const data = snap.data()
  const batch = writeBatch(db)
  batch.update(extRef(orgId, id), { deletedAt: null, deletedBy: null, updatedAt: serverTimestamp() })
  if (data.qrToken) {
    batch.set(qrRef(data.qrToken), mirrorPayload(orgId, orgName, id, { ...data, deletedAt: null }))
  }
  // Restoring re-adds the unit to the active fleet (+1 to its buckets).
  applyStatsDelta(batch, orgId, statsDeltaFor(null, { ...data, deletedAt: null }))
  await batch.commit()
  await logAudit(orgId, actor, AUDIT.EXT_RESTORE, { targetId: id, targetLabel: extLabelOf(data) })
}

/** Permanently delete a soft-deleted extinguisher (admin only — enforced by rules). */
export async function purgeExtinguisher(orgId, id, qrToken, actor, label) {
  const batch = writeBatch(db)
  batch.delete(extRef(orgId, id))
  if (qrToken) batch.delete(qrRef(qrToken))
  await batch.commit()
  await logAudit(orgId, actor, AUDIT.EXT_PURGE, { targetId: id, targetLabel: label || '' })
}

// Max extinguishers loaded into the live in-memory set. The dashboard + all
// lists derive from this set client-side, so we cap it for scale; a banner warns
// when the cap is hit. (Full server-side pagination is a future enhancement.)
export const EXT_LOAD_CAP = 2000

export function subscribeExtinguishers(orgId, cb, max = EXT_LOAD_CAP) {
  const q = query(extCol(orgId), orderBy('createdAt', 'desc'), limit(max))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export const PAGE_SIZE = 50

/**
 * One page of extinguishers via cursor pagination + server-side equality
 * filters. Returns { rows, nextCursor, hasMore }.
 *  - filters: { type, capacity, entity, region, status } (use FILTER_ALL to skip)
 *  - cursor: the last QueryDocumentSnapshot from the previous page (or null)
 * Excludes soft-deleted (deletedAt == null), newest first.
 * Requires composite indexes (deletedAt + the filtered field + createdAt) —
 * Firestore will surface a one-click index link for any missing combo.
 */
export async function queryExtinguishersPage(orgId, { filters = {}, cursor = null, pageSize = PAGE_SIZE } = {}) {
  const constraints = buildExtinguisherConstraints(filters).map((c) => where(c.field, c.op, c.value))
  const parts = [...constraints, orderBy('createdAt', 'desc')]
  if (cursor) parts.push(startAfter(cursor))
  parts.push(limit(pageSize + 1)) // +1 sentinel to detect "has more"
  const snap = await getDocs(query(extCol(orgId), ...parts))
  const docs = snap.docs
  const hasMore = docs.length > pageSize
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs
  return {
    rows: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: pageDocs.length ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  }
}

export async function getExtinguisher(orgId, id) {
  const snap = await getDoc(extRef(orgId, id))
  return snap.exists() ? { id, ...snap.data() } : null
}

// ── Public QR ───────────────────────────────────────────────────────────────────

export async function getExtinguisherByToken(token) {
  const snap = await getDoc(qrRef(token))
  return snap.exists() ? { ...snap.data() } : null
}

// ── Reports (approval queue) ──────────────────────────────────────────────────

/**
 * Submit a report (defect or status change). Works for authenticated portal
 * users AND public QR visitors. Always lands as `pending`.
 */
export async function createReport(orgId, report) {
  await addDoc(reportCol(orgId), {
    extId: report.extId,
    extLabel: report.extLabel || '',
    kind: report.kind, // 'defect' | 'status_change'
    defectType: report.defectType || null,
    newStatus: report.newStatus || null,
    note: report.note || '',
    reportedBy: report.reportedBy || 'public',
    reportedByName: report.reportedByName || 'QR Scan (Public)',
    reporterRole: report.reporterRole || null,
    source: report.source || 'portal',
    approvalStatus: 'pending',
    reportedAt: serverTimestamp(),
  })
  const what = report.kind === 'defect' ? `defect (${report.defectType})` : `status → ${report.newStatus}`
  await logAudit(orgId, { uid: report.reportedBy, name: report.reportedByName }, AUDIT.REPORT_CREATE, {
    target: 'report',
    targetLabel: report.extLabel || report.extId,
    summary: `Reported ${what}${report.reporterRole ? ` (by ${report.reporterRole})` : ''}`,
    source: report.source || 'portal',
  })
}

export function subscribeReports(orgId, cb) {
  const q = query(reportCol(orgId), orderBy('reportedAt', 'desc'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

/**
 * Approve a report and apply its effect to the extinguisher:
 *  - defect that triggers refill  → add defect + set status TO_BE_REFILLED
 *  - physical defect              → add defect (status unchanged)
 *  - status_change                → set the requested status
 */
export async function approveReport(orgId, orgName, report, reviewerName, actor) {
  const ext = await getExtinguisher(orgId, report.extId)
  if (!ext) throw new Error('Extinguisher no longer exists')

  const updates = {}
  if (report.kind === 'defect' && report.defectType) {
    const defects = new Set(ext.physicalDefects || [])
    defects.add(report.defectType)
    updates.physicalDefects = Array.from(defects)
    if (REFILL_DEFECT_KEYS.includes(report.defectType) && ext.status !== STATUS.CLOSED) {
      updates.status = STATUS.TO_BE_REFILLED
    }
  } else if (report.kind === 'status_change' && report.newStatus) {
    updates.status = report.newStatus
  }

  const reviewer = actor || { name: reviewerName }
  // Apply silently (no generic edit audit); we log the approve below.
  await updateExtinguisher(orgId, orgName, report.extId, updates, { silent: true })
  await updateDoc(reportRef(orgId, report.id), {
    approvalStatus: 'approved',
    reviewedBy: reviewerName || '',
    reviewedAt: serverTimestamp(),
  })
  const what = report.kind === 'defect' ? `defect (${report.defectType})` : `status → ${report.newStatus}`
  await logAudit(orgId, reviewer, AUDIT.REPORT_APPROVE, {
    target: 'report',
    targetId: report.extId,
    targetLabel: report.extLabel || report.extId,
    summary: `Approved ${what}`,
  })
}

export async function rejectReport(orgId, report, reviewerName, actor) {
  await updateDoc(reportRef(orgId, report.id), {
    approvalStatus: 'rejected',
    reviewedBy: reviewerName || '',
    reviewedAt: serverTimestamp(),
  })
  const what = report.kind === 'defect' ? `defect (${report.defectType})` : `status → ${report.newStatus}`
  await logAudit(orgId, actor || { name: reviewerName }, AUDIT.REPORT_REJECT, {
    target: 'report',
    targetId: report.extId,
    targetLabel: report.extLabel || report.extId,
    summary: `Rejected ${what}`,
  })
}

// ── Workflow transitions (direct, used by portal action buttons) ───────────────
// Each stamps who performed the action (lastActionBy/lastAction/lastActionAt).

function actionStamp(actorName, label) {
  return { lastActionBy: actorName || '', lastAction: label, lastActionAt: serverTimestamp() }
}

/** Vendor received the extinguisher for refilling. */
export async function markReceivedByVendor(orgId, orgName, id, actorName) {
  await updateExtinguisher(orgId, orgName, id, {
    status: STATUS.IN_PROCESS_REFILLING,
    ...actionStamp(actorName, 'Sent to vendor'),
  }, { actor: { name: actorName }, action: AUDIT.WF_SENT_TO_VENDOR, summary: 'Marked received by vendor (In Process)' })
}

/** Extinguisher refilled & returned: close it, set new due dates, clear defects. */
export async function markRefilledAndClosed(orgId, orgName, id, { dateOfNextRefill, dateOfNextHPT }, actorName) {
  await updateExtinguisher(orgId, orgName, id, {
    status: STATUS.ACTIVE,
    dateOfNextRefill,
    dateOfNextHPT,
    physicalDefects: [],
    lastRefilledAt: new Date().toISOString().slice(0, 10),
    ...actionStamp(actorName, 'Refilled & Closed'),
  }, { actor: { name: actorName }, action: AUDIT.WF_REFILLED_CLOSED, summary: `Refilled & closed (next refill ${dateOfNextRefill}, next HPT ${dateOfNextHPT})` })
}

/** Resolve (clear) physical defects without a refill. */
export async function resolveDefects(orgId, orgName, id, remainingDefects = [], actorName) {
  await updateExtinguisher(orgId, orgName, id, {
    physicalDefects: remainingDefects,
    ...actionStamp(actorName, 'Resolved defects'),
  }, { actor: { name: actorName }, action: AUDIT.WF_RESOLVED_DEFECTS, summary: 'Physical defects resolved' })
}
