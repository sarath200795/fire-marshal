// ─────────────────────────────────────────────────────────────────────────────
// Fire Marshal "Sam" — rule-based safety assistant. Pure functions over the live
// fleet data (no LLM): per-page onboarding tips, suggested questions, and a
// scored-intent answer() that understands free-typed questions and reports
// counts/examples from the extinguisher fleet, refill/defect workflow, quotations
// and dashboard summary. An optional AI fallback (askAI) handles anything the
// rules miss.
// ─────────────────────────────────────────────────────────────────────────────
import {
  deriveStatus, isToBeRefilled, isInProcess, isPhysicalDefect, isRefilledClosed,
  hasQuotation, needsQuotation,
} from './extinguisherLogic'
import { DEFECT_BY_KEY, STATUS_LABEL } from './constants'

const pageOf = (pathname = '') => {
  if (pathname.includes('/repository')) return 'repository'
  if (pathname.includes('/refill-due')) return 'refill-due'
  if (pathname.includes('/in-process')) return 'in-process'
  if (pathname.includes('/physical-defects')) return 'physical-defects'
  if (pathname.includes('/physical-open') || pathname.includes('/physical-closed')) return 'physical-log'
  if (pathname.includes('/closed')) return 'closed'
  if (pathname.includes('/approvals')) return 'approvals'
  if (pathname.includes('/add')) return 'add'
  if (pathname.includes('/bulk-upload')) return 'bulk-upload'
  if (pathname.includes('/qr-print')) return 'qr-print'
  if (pathname.includes('/users')) return 'users'
  return 'dashboard'
}

const GUIDES = {
  dashboard: {
    title: 'Dashboard',
    tips: [
      'Your live fleet overview — click any chart slice or bar to filter every widget at once.',
      'KPI cards: Total, Healthy, To Be Refilled, In Process, Physical Defects, Refilled & Closed.',
      'Use the Condition legend at the top to focus on a single defect/due category.',
    ],
  },
  repository: {
    title: 'Repository',
    tips: [
      'Every extinguisher lives here. Filter by Type / Capacity / Entity / Region / Status + search.',
      'Select rows to bulk export, print QR labels, or move to the Recycle Bin.',
      'Per-row actions: submit quotation, send to vendor, resolve defects, edit, report a defect, view QR.',
    ],
  },
  'refill-due': {
    title: 'To Be Refilled',
    tips: [
      'Units due for refill/HPT within 30 days, or flagged Empty / Over-Pressurized.',
      'Submit a vendor quotation first — then "Received by vendor" moves it to In Process.',
    ],
  },
  'in-process': {
    title: 'In Process',
    tips: [
      'Units currently with the vendor for refilling.',
      'When returned, click "Refilled & closed" and set the new Next-Refill / Next-HPT dates.',
    ],
  },
  'physical-defects': {
    title: 'Physical Defects',
    tips: [
      'Units with PIN, stand, hose or handle damage needing physical repair.',
      'Submit a quotation, then "Resolve" once the repair is done.',
    ],
  },
  'physical-log': {
    title: 'Physical Defect Log',
    tips: ['A record of approved physical-defect reports — Open (still active) and Closed (resolved).'],
  },
  closed: {
    title: 'Refilled & Closed',
    tips: ['Completed refill cycles with their updated due dates.'],
  },
  approvals: {
    title: 'Approvals',
    tips: [
      'QR-scan and portal reports land here as "pending".',
      'Approving a defect adds it to the unit; a refill report moves the unit to To Be Refilled.',
    ],
  },
  add: {
    title: 'Add Extinguisher',
    tips: ['Fill the details (Center is required); leave Serial blank for an auto FE-#### serial. A QR code is generated on save.'],
  },
  'bulk-upload': {
    title: 'Bulk Upload',
    tips: ['Download the template, fill one row per extinguisher, upload to preview, then import. Matching Serial Nos overwrite (spec/dates only).'],
  },
  'qr-print': {
    title: 'Print QR Codes',
    tips: ['Select extinguishers and print 3-up A4 QR labels. Scanning a label opens the public status page.'],
  },
  users: {
    title: 'Team & Approvals',
    tips: ['Approve teammates joining your org and manage roles. Use "List my organization" to make it joinable at signup.'],
  },
}

export function pageGuide(pathname) {
  return GUIDES[pageOf(pathname)] || GUIDES.dashboard
}

const COMMON_QS = ['Give me a summary', 'What needs attention?', 'How many extinguishers?']
const PAGE_QS = {
  dashboard: ['What needs attention?', 'How many are due for refill?', 'Which region has the most defects?'],
  repository: ['How many extinguishers?', 'How many need a quotation?', 'What types do we have?'],
  'refill-due': ['How many are due for refill?', 'How many need a quotation?', 'What should I do first?'],
  'in-process': ['How many are in process?', 'How do I close a refill?'],
  'physical-defects': ['How many physical defects?', 'Which defects are most common?'],
  approvals: ['How many pending approvals?', 'What is pending?'],
  add: ['Which extinguisher for an electrical fire?', 'How often should extinguishers be serviced?'],
}
export function suggestedQuestions(pathname) {
  const p = pageOf(pathname)
  return [...(PAGE_QS[p] || []), ...COMMON_QS].slice(0, 5)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

const list = (names, n = 3) => {
  const shown = names.filter(Boolean).slice(0, n)
  const extra = names.length - shown.length
  return shown.join(', ') + (extra > 0 ? ` and ${extra} more` : '')
}

const extLabel = (e) => e.serialNo || `${e.type || 'Extinguisher'} @ ${e.centerName || 'site'}`

// count occurrences of a key in a [{...}] list by a field accessor
function tally(items, keyFn) {
  const m = {}
  for (const it of items) {
    const k = keyFn(it)
    if (k == null || k === '') continue
    m[k] = (m[k] || 0) + 1
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

const hit = (text) => ({ text, matched: true })
const miss = (text) => ({ text, matched: false })
const nav = (text, to) => ({ text, matched: true, action: { type: 'navigate', to } })

// Concise fire-safety guidance, citing the UK HSE. Returns null when the topic
// isn't recognised so the caller can defer to the AI fallback.
const HSE = 'For authoritative guidance see the UK HSE: https://www.hse.gov.uk/.'
function guidanceAnswer(qn) {
  if ((qn.includes('which') || qn.includes('what') || qn.includes('type')) && qn.includes('electric'))
    return `For electrical fires use a CO₂ extinguisher (or a dry-powder one) — never water or foam on live electrics. CO₂ leaves no residue, ideal around equipment. ${HSE}`
  if ((qn.includes('which') || qn.includes('what') || qn.includes('type')) && (qn.includes('kitchen') || qn.includes('cooking') || qn.includes('oil') || qn.includes('fat')))
    return `For cooking-oil/fat fires (Class F) use a wet-chemical extinguisher. Never use water. ${HSE}`
  if (qn.includes('class') && qn.includes('fire'))
    return `Fire classes: A = solids (wood/paper), B = flammable liquids, C = gases, D = metals, E/electrical, F = cooking oils. Match the extinguisher to the class — ABC dry powder covers A, B and electrical; CO₂ for electrical; wet-chemical for F. ${HSE}`
  if (qn.includes('how to use') || qn.includes('how do i use') || qn.includes('pass'))
    return `Use the PASS technique: Pull the pin, Aim at the base of the fire, Squeeze the handle, Sweep side to side. Only tackle a small fire with a clear exit behind you. ${HSE}`
  if (qn.includes('how often') || qn.includes('service') || qn.includes('inspect') || qn.includes('maintenance schedule'))
    return `Best practice (BS 5306): a monthly visual check by the user, an annual "basic" service by a competent person, and an extended service / refill on a longer cycle (commonly 5 years, 10 for CO₂). Track each unit's Next-Refill and Next-HPT dates here. ${HSE}`
  if (qn.includes('hpt') || qn.includes('hydro') || qn.includes('pressure test'))
    return `HPT = Hydrostatic Pressure Test — periodic testing of the cylinder's integrity (commonly every 5 years, 10 for CO₂). The Next-HPT date on each unit flags when it's due. ${HSE}`
  if (qn.includes('refill') && (qn.includes('what') || qn.includes('when') || qn.includes('why')))
    return `An extinguisher needs refilling after any use, when it reads empty/under-pressure, or at its scheduled service. In Fire Marshal it moves: To Be Refilled → (quotation) → Received by vendor → In Process → Refilled & Closed. ${HSE}`
  return null
}

// Fuzzy "did you mean" by shared significant words + substring bonus.
function closest(qn, names = []) {
  const qset = new Set(qn.split(' ').filter((w) => w.length > 2))
  let best = null
  let bestScore = 0
  for (const n of names) {
    if (!n) continue
    let s = 0
    for (const w of norm(n).split(' ')) if (w.length > 2 && qset.has(w)) s++
    if (qn.includes(norm(n)) && norm(n).length > 2) s += 3
    if (s > bestScore) { bestScore = s; best = n }
  }
  return bestScore > 0 ? best : null
}

// ── Answering ────────────────────────────────────────────────────────────────
/**
 * Answer a free-typed question from the live fleet context.
 * ctx = { extinguishers, refillDue, inProcess, physicalDefects, closed,
 *         physicalOpen, pendingReports, summary, stats, pathname }
 */
export function answer(question, ctx) {
  const c = ctx || {}
  const ext = c.extinguishers || []
  const refillDue = c.refillDue || []
  const inProcess = c.inProcess || []
  const physical = c.physicalDefects || []
  const closed = c.closed || []
  const pending = c.pendingReports || []
  const summary = c.summary || {}
  const today = new Date()
  const qn = norm(question)
  if (!qn) return hit('Ask me anything about your extinguishers — try “give me a summary” or “what needs attention?”.')

  // Items awaiting a quotation before they can progress.
  const awaitingQuote = ext.filter((e) => needsQuotation(e, today))
  const quoted = ext.filter((e) => hasQuotation(e))

  // ── Navigation intent (add an extinguisher) ──
  if (/\b(add|create|new|register)\b/.test(qn) && qn.includes('extinguish'))
    return nav('Opening the Add Extinguisher form for you. 🧯', '/app/add')
  if (qn.includes('bulk') || (qn.includes('upload') && qn.includes('many')))
    return nav('Opening Bulk Upload — download the template, fill it, and import. 📥', '/app/bulk-upload')

  // ── Region / center entity lookups ──
  const regions = Array.from(new Set(ext.map((e) => e.region).filter(Boolean)))
  const centers = Array.from(new Set(ext.map((e) => e.centerName).filter(Boolean)))
  const regionHit = regions.find((r) => norm(r).length >= 2 && qn.includes(norm(r)))
  const centerHit = centers.find((cn) => norm(cn).length >= 3 && qn.includes(norm(cn)))
  if (centerHit) {
    const rows = ext.filter((e) => norm(e.centerName) === norm(centerHit))
    const due = rows.filter((e) => isToBeRefilled(e, today)).length
    const def = rows.filter((e) => isPhysicalDefect(e)).length
    return hit(`${centerHit}: ${rows.length} extinguisher(s)${due ? `, ${due} due for refill` : ''}${def ? `, ${def} with physical defects` : ''}.`)
  }
  if (regionHit) {
    const rows = ext.filter((e) => norm(e.region) === norm(regionHit))
    const due = rows.filter((e) => isToBeRefilled(e, today)).length
    return hit(`${regionHit} region: ${rows.length} extinguisher(s)${due ? `, ${due} due for refill` : ''}.`)
  }

  const tokens = new Set(qn.split(' '))
  const INTENTS = [
    {
      // Fire-safety guidance (general knowledge)
      keywords: ['which extinguish', 'what extinguish', 'type of fire', 'class of fire', 'class fire', 'electric', 'kitchen', 'cooking', 'how to use', 'how do i use', 'pass technique', 'how often', 'service', 'inspect', 'maintenance schedule', 'hpt', 'hydro', 'pressure test', 'guidance', 'best practice'],
      run: () => guidanceAnswer(qn) || HSE,
    },
    {
      // priorities / what needs attention
      keywords: ['attention', 'what should i', 'what do i do', 'priorit', 'urgent', 'focus', 'first', 'recommend', 'advice', 'where do i start', 'action'],
      run: () => {
        const parts = []
        if (awaitingQuote.length) parts.push(`${awaitingQuote.length} unit(s) need a quotation before they can move forward: ${list(awaitingQuote.map(extLabel), 2)}.`)
        const overdue = refillDue.filter((e) => deriveStatus(e, today).flags.REFILL_DUE || deriveStatus(e, today).flags.HPT_DUE)
        if (overdue.length) parts.push(`${overdue.length} unit(s) are overdue for refill/HPT: ${list(overdue.map(extLabel), 2)}.`)
        if (physical.length) parts.push(`${physical.length} physical defect(s) to resolve.`)
        if (pending.length) parts.push(`${pending.length} report(s) awaiting approval.`)
        if (!parts.length) return 'You’re in good shape — nothing overdue, no open defects, and no pending approvals. 🎉'
        return `Here’s where to focus:\n${parts.map((p, i) => `${i + 1}) ${p}`).join('\n')}`
      },
    },
    {
      // quotations
      keywords: ['quotation', 'quote', 'quoted', 'estimate', 'cost'],
      run: () => {
        if (!awaitingQuote.length && !quoted.length) return 'No quotations needed right now — no units are in a refill/defect cycle.'
        return `${awaitingQuote.length} unit(s) still need a quotation before they can progress; ${quoted.length} already have one.${awaitingQuote.length ? ` Awaiting: ${list(awaitingQuote.map(extLabel))}.` : ''}`
      },
    },
    {
      // refill due
      keywords: ['refill', 'due', 'to be refilled', 'overdue', 'expir'],
      run: () => {
        if (!refillDue.length) return 'Nothing is due for refilling right now. 🎉'
        return `${refillDue.length} extinguisher(s) to be refilled (due within 30 days, or flagged empty/over-pressurized): ${list(refillDue.map(extLabel))}.`
      },
    },
    {
      // in process
      keywords: ['in process', 'with vendor', 'being refilled', 'sent to vendor'],
      run: () => inProcess.length
        ? `${inProcess.length} extinguisher(s) in process with the vendor: ${list(inProcess.map(extLabel))}.`
        : 'No extinguishers are currently in process with a vendor.',
    },
    {
      // physical defects
      keywords: ['physical defect', 'defect', 'damage', 'pin', 'hose', 'handle', 'stand', 'broken', 'faulty'],
      run: () => {
        if (!physical.length) return 'No open physical defects — all units are physically intact. 🛠️'
        const byType = tally(physical.flatMap((e) => deriveStatus(e, today).physicalDefects), (k) => DEFECT_BY_KEY[k]?.label || k)
        return `${physical.length} unit(s) with physical defects. Most common: ${byType.slice(0, 3).map(([d, n]) => `${d} (${n})`).join(', ')}.`
      },
    },
    {
      // approvals
      keywords: ['approval', 'pending', 'awaiting', 'to approve', 'review'],
      run: () => pending.length
        ? `${pending.length} report(s) awaiting approval in the Approvals queue.`
        : 'No reports are pending approval right now.',
    },
    {
      // closed / completed
      keywords: ['closed', 'completed', 'refilled and closed', 'done'],
      run: () => `${closed.length} completed refill cycle(s) on record.`,
    },
    {
      // breakdown by type / capacity / entity / region
      keywords: ['what type', 'types', 'by type', 'breakdown', 'capacity', 'entity', 'by region', 'distribution'],
      run: () => {
        const byType = tally(ext, (e) => e.type)
        const byRegion = tally(ext, (e) => e.region)
        return `By type: ${byType.map(([t, n]) => `${t} (${n})`).join(', ') || '—'}.${byRegion.length ? ` By region: ${byRegion.slice(0, 4).map(([r, n]) => `${r} (${n})`).join(', ')}.` : ''}`
      },
    },
    {
      // which region/center has the most
      keywords: ['which region', 'which center', 'which site', 'most', 'busiest', 'worst', 'where'],
      run: () => {
        const byRegion = tally(ext, (e) => e.region)
        const defByRegion = tally(physical, (e) => e.region)
        if (qn.includes('defect') && defByRegion.length) return `Most physical defects: ${defByRegion[0][0]} (${defByRegion[0][1]}).`
        if (!byRegion.length) return 'No region data recorded yet.'
        return `Largest fleet by region: ${byRegion[0][0]} (${byRegion[0][1]}).${byRegion.length > 1 ? ` Next: ${byRegion.slice(1, 3).map(([r, n]) => `${r} (${n})`).join(', ')}.` : ''}`
      },
    },
    {
      // counts / totals / summary
      keywords: ['how many', 'total', 'count', 'summary', 'overview', 'snapshot', 'status', 'how are we', 'how many extinguish'],
      run: () => `Snapshot: ${summary.total ?? ext.length} extinguisher(s) — ${summary.healthy || 0} healthy, ${refillDue.length} to be refilled, ${inProcess.length} in process, ${physical.length} with physical defects, ${closed.length} refilled & closed.${awaitingQuote.length ? ` ${awaitingQuote.length} awaiting a quotation.` : ''}${pending.length ? ` ${pending.length} pending approval.` : ''}`,
    },
    {
      keywords: ['help', 'what can you', 'who are you', 'what do you do'],
      tokenKeywords: ['hi', 'hello', 'hey'],
      run: () => 'Hi! I read your live fleet data. Ask me for a summary, what needs attention, refill-due / in-process / defect counts, quotations awaiting, pending approvals, a region or center breakdown — or general fire-safety guidance (e.g. “which extinguisher for an electrical fire?”).',
    },
  ]

  let best = null
  let bestScore = 0
  for (const intent of INTENTS) {
    let s = 0
    for (const k of intent.keywords || []) if (qn.includes(k)) s++
    for (const k of intent.tokenKeywords || []) if (tokens.has(k)) s++
    if (s > bestScore) { bestScore = s; best = intent }
  }
  if (best && bestScore > 0) return hit(best.run())

  // ── Nothing matched → clarify or defer to AI ──
  const centerGuess = closest(qn, centers)
  if (centerGuess && /center|site|location|where|at /.test(qn))
    return hit(`Did you mean the center “${centerGuess}”? Try “extinguishers at ${centerGuess}”.`)

  const safetyish = /fire|extinguish|refill|defect|safety|hpt|pressure|hazard|risk|co2|foam|powder/.test(qn)
  if (safetyish)
    return miss(`Could you be a bit more specific? Ask about refill-due, in-process, physical defects, quotations, pending approvals, or a region/center — or for fire-safety guidance see the HSE: https://www.hse.gov.uk/.`)

  const qs = suggestedQuestions(c.pathname)
  return miss(`I’m not sure I follow — did you want a summary, what needs attention, or a breakdown by type/region? Try: “${qs.slice(0, 3).join('”, “')}”.`)
}

export function answerText(question, ctx) {
  return answer(question, ctx).text
}

// ── AI fallback ───────────────────────────────────────────────────────────────
/** Compact, data-only snapshot for the LLM (aggregates only — no PII). */
export function buildAIContext(ctx) {
  const c = ctx || {}
  const ext = c.extinguishers || []
  const today = new Date()
  const byType = tally(ext, (e) => e.type)
  const byRegion = tally(ext, (e) => e.region)
  const byEntity = tally(ext, (e) => e.entity)
  const byStatus = tally(ext, (e) => STATUS_LABEL[e.status] || e.status)
  const awaitingQuote = ext.filter((e) => needsQuotation(e, today)).length
  return {
    totals: {
      extinguishers: (c.summary?.total) ?? ext.length,
      healthy: c.summary?.healthy || 0,
      toBeRefilled: (c.refillDue || []).length,
      inProcess: (c.inProcess || []).length,
      physicalDefects: (c.physicalDefects || []).length,
      refilledClosed: (c.closed || []).length,
      awaitingQuotation: awaitingQuote,
      pendingApprovals: (c.pendingReports || []).length,
    },
    byType: byType.map(([type, count]) => ({ type, count })),
    byRegion: byRegion.map(([region, count]) => ({ region, count })),
    byEntity: byEntity.map(([entity, count]) => ({ entity, count })),
    byStatus: byStatus.map(([status, count]) => ({ status, count })),
    fleetWideTotals: c.stats || null,
  }
}

/** Ask the server-side AI proxy. Returns the answer string or null on any failure. */
export async function askAI(question, context) {
  try {
    const r = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context }),
    })
    if (!r.ok) return null
    const d = await r.json().catch(() => null)
    const text = d?.answer ? String(d.answer).trim() : ''
    return text || null
  } catch {
    return null
  }
}
