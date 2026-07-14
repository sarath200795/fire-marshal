// ─────────────────────────────────────────────────────────────────────────────
// Derived status for the AED and FAS asset modules. Pure functions over a list
// held in memory (same pattern as extinguisherLogic). Dates reuse toDate/
// daysUntil so a corrupt value degrades to null instead of crashing.
// ─────────────────────────────────────────────────────────────────────────────
import { daysUntil } from './extinguisherLogic'
import { AED_STATUS, FAS_STATUS } from './constants'

export const DUE_SOON = 30

// 'expired' | 'due' (within DUE_SOON days) | 'ok' | null (no/invalid date)
export function dueState(value, today = new Date()) {
  const d = daysUntil(value, today)
  if (d === null) return null
  if (d <= 0) return 'expired'
  if (d <= DUE_SOON) return 'due'
  return 'ok'
}
const flagged = (s) => s === 'expired' || s === 'due'

// ── AED ──────────────────────────────────────────────────────────────────────
export function aedCondition(a, today = new Date()) {
  const states = [dueState(a.batteryExpiry, today), dueState(a.padExpiry, today), dueState(a.nextInspection, today)]
  const expired = a.status === AED_STATUS.OUT_OF_SERVICE || states.includes('expired')
  const due = !expired && (a.status === AED_STATUS.SERVICE_DUE || states.includes('due'))
  return { expired, due, ok: !expired && !due }
}
export function aedColor(a, today = new Date()) {
  const c = aedCondition(a, today)
  return c.expired ? '#dc2626' : c.due ? '#f59e0b' : '#16a34a'
}
export function aedSummary(list, today = new Date()) {
  const s = { total: list.length, ready: 0, due: 0, outOfService: 0, batteryExpiring: 0, padExpiring: 0, inspectionDue: 0 }
  for (const a of list) {
    const c = aedCondition(a, today)
    if (a.status === AED_STATUS.OUT_OF_SERVICE) s.outOfService++
    else if (c.due || c.expired) s.due++
    else s.ready++
    if (flagged(dueState(a.batteryExpiry, today))) s.batteryExpiring++
    if (flagged(dueState(a.padExpiry, today))) s.padExpiring++
    if (flagged(dueState(a.nextInspection, today))) s.inspectionDue++
  }
  return s
}

// ── FAS ──────────────────────────────────────────────────────────────────────
export function fasCondition(a, today = new Date()) {
  const svc = dueState(a.nextService, today)
  const expired = a.status === FAS_STATUS.FAULTY || svc === 'expired'
  const due = !expired && (a.status === FAS_STATUS.SERVICE_DUE || svc === 'due')
  return { expired, due, ok: !expired && !due }
}
export function fasColor(a, today = new Date()) {
  const c = fasCondition(a, today)
  return c.expired ? '#dc2626' : c.due ? '#f59e0b' : '#16a34a'
}
export function fasSummary(list, today = new Date()) {
  const s = { total: list.length, operational: 0, due: 0, faulty: 0, serviceDue: 0 }
  for (const a of list) {
    const c = fasCondition(a, today)
    if (a.status === FAS_STATUS.FAULTY) s.faulty++
    else if (c.due || c.expired) s.due++
    else s.operational++
    if (flagged(dueState(a.nextService, today))) s.serviceDue++
  }
  return s
}
