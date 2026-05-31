import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Wrench, CheckCircle2, Search, X, Filter, Download, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, Badge } from '../components/ui'
import { useFleet } from '../context/FleetContext'
import { exportExtinguishers } from '../lib/exporter'
import { toDate } from '../lib/extinguisherLogic'
import {
  TYPES, CAPACITIES, ENTITIES, REGIONS, PHYSICAL_DEFECT_KEYS, DEFECT_BY_KEY, REGION_COLORS,
} from '../lib/constants'

const ALL = '__all__'

/**
 * Records of physical-defect reports (approved).
 *  - mode="open"   → defect still active on the unit
 *  - mode="closed" → defect resolved (or unit refilled-away / deleted)
 * Filterable by every creation field except dates.
 */
export default function PhysicalDefectLog({ mode = 'open' }) {
  const fleet = useFleet()
  const rows = mode === 'open' ? fleet.physicalOpen : fleet.physicalClosed

  const [search, setSearch] = useState('')
  const [type, setType] = useState(ALL)
  const [capacity, setCapacity] = useState(ALL)
  const [entity, setEntity] = useState(ALL)
  const [region, setRegion] = useState(ALL)
  const [defect, setDefect] = useState(ALL)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !(`${r.serialNo} ${r.centerName}`.toLowerCase().includes(q))) return false
      if (type !== ALL && r.type !== type) return false
      if (capacity !== ALL && r.capacity !== capacity) return false
      if (entity !== ALL && r.entity !== entity) return false
      if (region !== ALL && r.region !== region) return false
      if (defect !== ALL && r.defectType !== defect) return false
      return true
    })
  }, [rows, search, type, capacity, entity, region, defect])

  const clearFilters = () => {
    setSearch(''); setType(ALL); setCapacity(ALL); setEntity(ALL); setRegion(ALL); setDefect(ALL)
  }
  const filtersActive = search || [type, capacity, entity, region, defect].some((v) => v !== ALL)

  const isClosed = mode === 'closed'
  const title = isClosed ? 'Physical Defects (Closed)' : 'Physical Defects (Open)'
  const fileBase = isClosed ? 'physical-defects-closed' : 'physical-defects-open'

  const fmt = (v) => {
    const d = toDate(v)
    return d ? format(d, 'dd MMM yyyy') : '—'
  }

  const doExport = () => {
    if (!filtered.length) return toast.error('Nothing to export')
    // rows already carry extinguisher fields + defectLabel; export as-is.
    exportExtinguishers(filtered, `${fileBase}-${filtered.length}.xlsx`)
    toast.success(`Exported ${filtered.length} rows`)
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={
          isClosed
            ? 'Approved physical-defect reports that have since been resolved.'
            : 'Approved physical-defect reports still active on their units.'
        }
        icon={isClosed ? CheckCircle2 : Wrench}
      >
        <button className="btn-ghost" onClick={doExport}><Download size={16} /> Export</button>
      </PageHeader>

      {/* Filters (no dates) */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-400">
          <Filter size={13} /> Filters
        </span>
        <div className="relative min-w-[180px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search serial or center…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={defect} onChange={(e) => setDefect(e.target.value)}>
          <option value={ALL}>All defects</option>
          {PHYSICAL_DEFECT_KEYS.map((k) => <option key={k} value={k}>{DEFECT_BY_KEY[k].label}</option>)}
        </select>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value={ALL}>All types</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="input w-auto" value={capacity} onChange={(e) => setCapacity(e.target.value)}>
          <option value={ALL}>All capacities</option>
          {CAPACITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input w-auto" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value={ALL}>All entities</option>
          {ENTITIES.map((en) => <option key={en}>{en}</option>)}
        </select>
        <select className="input w-auto" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value={ALL}>All regions</option>
          {REGIONS.map((rg) => <option key={rg}>{rg}</option>)}
        </select>
        {filtersActive && (
          <button className="btn-ghost" onClick={clearFilters}><X size={15} /> Clear</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={isClosed ? CheckCircle2 : Wrench}
          title={rows.length ? 'No matches' : isClosed ? 'No resolved defects yet' : 'No open physical defects'}
          hint={rows.length ? 'Try adjusting your filters.' : isClosed ? 'Resolved physical defects will be recorded here.' : 'Approved physical defects appear here. 🛠️'}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Serial / Type</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Center</th>
                  <th className="px-4 py-3">Defect</th>
                  <th className="px-4 py-3">Reported</th>
                  <th className="px-4 py-3">{isClosed ? 'Resolved' : 'Approved'}</th>
                  <th className="px-4 py-3">Action By</th>
                  <th className="px-4 py-3 text-right">QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-200/60">
                {filtered.map((r, i) => {
                  const color = DEFECT_BY_KEY[r.defectType]?.color || '#64748b'
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4) }}
                      className="hover:bg-clay-100/50"
                      style={{ boxShadow: `inset 4px 0 0 ${color}` }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-ink-900">{r.serialNo || '—'}</div>
                        <div className="text-xs text-ink-500">{r.type}{r.capacity ? ` · ${r.capacity}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{r.entity || '—'}</td>
                      <td className="px-4 py-3">
                        {r.region ? <Badge color={REGION_COLORS[r.region] || '#64748b'}>{r.region}</Badge> : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{r.centerName}{r.deleted && <span className="ml-1 text-xs text-red-500">(deleted)</span>}</td>
                      <td className="px-4 py-3"><Badge color={color}>{r.defectLabel}</Badge></td>
                      <td className="px-4 py-3 text-ink-600">{fmt(r.reportedAt)}</td>
                      <td className="px-4 py-3 text-ink-600">{fmt(r.reviewedAt)}</td>
                      <td className="px-4 py-3">
                        {r.lastActionBy ? (
                          <div className="leading-tight">
                            <div className="font-medium text-ink-800">{r.lastActionBy}</div>
                            {r.lastAction && <div className="text-[11px] text-ink-400">{r.lastAction}</div>}
                          </div>
                        ) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.qrToken ? (
                          <a className="btn-ghost px-2.5 py-1.5 text-xs" href={`/qr/${r.qrToken}`} target="_blank" rel="noreferrer" title="Public QR">
                            <QrCode size={14} />
                          </a>
                        ) : <span className="text-ink-300">—</span>}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
