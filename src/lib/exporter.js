// xlsx helpers: bulk-upload template, parsing uploads, and exporting lists.
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { BULK_COLUMNS, TYPES, CAPACITIES, ENTITIES, REGIONS, DEFAULT_REGION, STATUS_LABEL } from './constants'
import { severityLabel, toDate } from './extinguisherLogic'

// Normalize a cell value (Date or string) to a yyyy-MM-dd string.
function toISODate(v) {
  if (!v) return ''
  if (v instanceof Date) return format(v, 'yyyy-MM-dd')
  const d = toDate(v)
  return d ? format(d, 'yyyy-MM-dd') : String(v)
}

// Robust browser download: build an array buffer, wrap in a Blob, click a
// temporary link. (XLSX.writeFile can fail silently in some bundled builds.)
function downloadWorkbook(wb, filename) {
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function bookFromRows(rows, sheetName = 'Extinguishers') {
  const ws = XLSX.utils.json_to_sheet(rows, rows.length ? undefined : { header: BULK_COLUMNS })
  ws['!cols'] = (rows.length ? Object.keys(rows[0]) : BULK_COLUMNS).map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return wb
}

/** Download an .xlsx template with the expected columns + one example row. */
export function downloadTemplate() {
  const example = {
    'Serial No': 'FE-0001',
    Type: 'ABC',
    Capacity: '5 Kg',
    Entity: '1P',
    Region: 'North',
    'Center Name': 'Tower B - Floor 3',
    'Date of Deployment': '2024-01-15',
    'Date of Next Refill': '2025-01-15',
    'Date of Next HPT': '2027-01-15',
  }
  const ws = XLSX.utils.json_to_sheet([example], { header: BULK_COLUMNS })
  ws['!cols'] = BULK_COLUMNS.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Extinguishers')
  downloadWorkbook(wb, 'fire-marshal-bulk-template.xlsx')
}

/**
 * Parse an uploaded .xlsx/.csv file into validated rows.
 * Returns { valid: [...extData], errors: [{row, issues}] }.
 */
export async function parseUpload(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  const valid = []
  const errors = []

  rows.forEach((r, idx) => {
    const rowNum = idx + 2 // header is row 1
    const region = String(r['Region'] ?? '').trim()
    const data = {
      serialNo: String(r['Serial No'] ?? '').trim(),
      type: String(r['Type'] ?? '').trim(),
      capacity: String(r['Capacity'] ?? '').trim(),
      entity: String(r['Entity'] ?? '').trim(),
      region: region || DEFAULT_REGION, // default if blank
      centerName: String(r['Center Name'] ?? '').trim(),
      dateOfDeployment: toISODate(r['Date of Deployment']),
      dateOfNextRefill: toISODate(r['Date of Next Refill']),
      dateOfNextHPT: toISODate(r['Date of Next HPT']),
    }

    const issues = []
    if (!data.centerName) issues.push('Center Name is required')
    if (!TYPES.includes(data.type)) issues.push(`Type must be one of ${TYPES.join(', ')}`)
    if (!CAPACITIES.includes(data.capacity)) issues.push(`Capacity must be one of ${CAPACITIES.join(', ')}`)
    if (!ENTITIES.includes(data.entity)) issues.push(`Entity must be one of ${ENTITIES.join(', ')}`)
    if (region && !REGIONS.includes(region)) issues.push(`Region must be one of ${REGIONS.join(', ')}`)

    if (issues.length) errors.push({ row: rowNum, data, issues })
    else valid.push(data)
  })

  return { valid, errors, total: rows.length }
}

// Build the row objects used by both export + email attachment.
function rowsFor(list, today = new Date()) {
  return list.map((e) => ({
    'Serial No': e.serialNo || '',
    Type: e.type,
    Capacity: e.capacity,
    Entity: e.entity,
    Region: e.region || '',
    'Center Name': e.centerName,
    'Date of Deployment': toISODate(e.dateOfDeployment),
    'Date of Next Refill': toISODate(e.dateOfNextRefill),
    'Date of Next HPT': toISODate(e.dateOfNextHPT),
    Status: STATUS_LABEL[e.status] || e.status,
    Condition: severityLabel(e, today),
    'QR Link': typeof window !== 'undefined' ? `${window.location.origin}/qr/${e.qrToken}` : e.qrToken,
  }))
}

/** Export a list of extinguishers to .xlsx, including derived condition/status. */
export function exportExtinguishers(list, filename = 'extinguishers.xlsx', today = new Date()) {
  downloadWorkbook(bookFromRows(rowsFor(list, today)), filename)
}

/** Same data as exportExtinguishers, but returned as a base64 string for email attachments. */
export function extinguishersToBase64(list, today = new Date()) {
  return XLSX.write(bookFromRows(rowsFor(list, today)), { type: 'base64', bookType: 'xlsx' })
}

/** Export audit-log rows to .xlsx. `rows` already shaped by the page (When/Actor/Action/…). */
export function exportAuditLogs(rows, filename = 'audit-log.xlsx') {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ When: '', Actor: '', Action: '', Target: '', Summary: '' }])
  ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 28 }, { wch: 50 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Log')
  downloadWorkbook(wb, filename)
}
