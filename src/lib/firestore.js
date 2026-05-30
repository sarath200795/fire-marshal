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
} from 'firebase/firestore'
import { db } from '../firebase'
import { generateQrToken } from './qr'
import { STATUS, REFILL_DEFECT_KEYS } from './constants'

// ── Path helpers ─────────────────────────────────────────────────────────────
const orgRef = (orgId) => doc(db, 'organizations', orgId)
const extCol = (orgId) => collection(db, 'organizations', orgId, 'extinguishers')
const extRef = (orgId, id) => doc(db, 'organizations', orgId, 'extinguishers', id)
const reportCol = (orgId) => collection(db, 'organizations', orgId, 'reports')
const reportRef = (orgId, id) => doc(db, 'organizations', orgId, 'reports', id)
const userRef = (uid) => doc(db, 'users', uid)
const qrRef = (token) => doc(db, 'qr', token)

// ── Organizations & users ─────────────────────────────────────────────────────

/** Create an org + its first admin user atomically. Returns the new orgId. */
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
  await batch.commit()
  return org.id
}

/** Find an organization by exact (case-insensitive) name. Returns {id, ...} or null. */
export async function findOrgByName(orgName) {
  const q = query(
    collection(db, 'organizations'),
    where('nameLower', '==', orgName.trim().toLowerCase()),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
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
export async function updateOrgSettings(orgId, updates) {
  await updateDoc(orgRef(orgId), updates)
}

export async function setUserStatus(uid, status) {
  await updateDoc(userRef(uid), { status })
}

export async function setUserRole(uid, role) {
  await updateDoc(userRef(uid), { role })
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
export async function addExtinguisher(orgId, orgName, data) {
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
  await batch.commit()
  return { id: ref.id, qrToken }
}

/** Bulk add many extinguishers in chunked batches. Returns count written. */
export async function bulkAddExtinguishers(orgId, orgName, rows) {
  let written = 0
  // Firestore batches max 500 ops; each row = 2 writes, so chunk by 200 rows.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
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
      written++
    }
    await batch.commit()
  }
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
export async function bulkUpsertExtinguishers(orgId, orgName, { creates = [], updates = [] }) {
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

  return { created, updated }
}

/** Update an extinguisher and keep its QR mirror in sync. */
export async function updateExtinguisher(orgId, orgName, id, updates) {
  const current = await getDoc(extRef(orgId, id))
  if (!current.exists()) throw new Error('Extinguisher not found')
  const merged = { ...current.data(), ...updates }
  const batch = writeBatch(db)
  batch.update(extRef(orgId, id), { ...updates, updatedAt: serverTimestamp() })
  if (merged.qrToken) {
    batch.set(qrRef(merged.qrToken), mirrorPayload(orgId, orgName, id, merged))
  }
  await batch.commit()
}

/** Delete one extinguisher + its mirror. */
export async function deleteExtinguisher(orgId, id, qrToken) {
  const batch = writeBatch(db)
  batch.delete(extRef(orgId, id))
  if (qrToken) batch.delete(qrRef(qrToken))
  await batch.commit()
}

/** Bulk delete extinguishers (+ mirrors) by [{id, qrToken}]. */
export async function bulkDeleteExtinguishers(orgId, items) {
  for (let i = 0; i < items.length; i += 200) {
    const chunk = items.slice(i, i + 200)
    const batch = writeBatch(db)
    for (const { id, qrToken } of chunk) {
      batch.delete(extRef(orgId, id))
      if (qrToken) batch.delete(qrRef(qrToken))
    }
    await batch.commit()
  }
}

export function subscribeExtinguishers(orgId, cb) {
  const q = query(extCol(orgId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
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
    source: report.source || 'portal',
    approvalStatus: 'pending',
    reportedAt: serverTimestamp(),
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
export async function approveReport(orgId, orgName, report, reviewerName) {
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

  await updateExtinguisher(orgId, orgName, report.extId, updates)
  await updateDoc(reportRef(orgId, report.id), {
    approvalStatus: 'approved',
    reviewedBy: reviewerName || '',
    reviewedAt: serverTimestamp(),
  })
}

export async function rejectReport(orgId, report, reviewerName) {
  await updateDoc(reportRef(orgId, report.id), {
    approvalStatus: 'rejected',
    reviewedBy: reviewerName || '',
    reviewedAt: serverTimestamp(),
  })
}

// ── Workflow transitions (direct, used by portal action buttons) ───────────────

/** Vendor received the extinguisher for refilling. */
export async function markReceivedByVendor(orgId, orgName, id) {
  await updateExtinguisher(orgId, orgName, id, { status: STATUS.IN_PROCESS_REFILLING })
}

/** Extinguisher refilled & returned: close it, set new due dates, clear defects. */
export async function markRefilledAndClosed(orgId, orgName, id, { dateOfNextRefill, dateOfNextHPT }) {
  await updateExtinguisher(orgId, orgName, id, {
    status: STATUS.ACTIVE,
    dateOfNextRefill,
    dateOfNextHPT,
    physicalDefects: [],
    lastRefilledAt: new Date().toISOString().slice(0, 10),
  })
}

/** Resolve (clear) physical defects without a refill. */
export async function resolveDefects(orgId, orgName, id, remainingDefects = []) {
  await updateExtinguisher(orgId, orgName, id, { physicalDefects: remainingDefects })
}
