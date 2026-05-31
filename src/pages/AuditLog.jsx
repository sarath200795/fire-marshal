import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ScrollText, Search, X, Filter, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, Badge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { subscribeAuditLogs } from '../lib/firestore'
import { exportAuditLogs } from '../lib/exporter'
import { AUDIT_META, auditMeta } from '../lib/audit'
import { toDate } from '../lib/extinguisherLogic'

const ALL = '__all__'

export default function AuditLog() {
  const { orgId } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState(ALL)

  useEffect(() => {
    if (!orgId) return
    const unsub = subscribeAuditLogs(orgId, (rows) => {
      setLogs(rows)
      setLoading(false)
    })
    return unsub
  }, [orgId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((l) => {
      if (action !== ALL && l.action !== action) return false
      if (q && !(`${l.actorName} ${l.targetLabel} ${l.summary} ${auditMeta(l.action).label}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [logs, search, action])

  const fmt = (v) => {
    const d = toDate(v)
    return d ? format(d, 'dd MMM yyyy, HH:mm') : '—'
  }

  const doExport = () => {
    if (!filtered.length) return toast.error('Nothing to export')
    const rows = filtered.map((l) => ({
      When: fmt(l.at),
      Actor: l.actorName || '',
      Action: auditMeta(l.action).label,
      Target: l.targetLabel || '',
      Summary: l.summary || '',
      Source: l.source || '',
    }))
    exportAuditLogs(rows, `audit-log-${filtered.length}.xlsx`)
    toast.success(`Exported ${filtered.length} entries`)
  }

  const clearFilters = () => { setSearch(''); setAction(ALL) }
  const filtersActive = search || action !== ALL

  // Distinct actions present, for the filter dropdown.
  const actionOptions = useMemo(() => {
    const present = new Set(logs.map((l) => l.action))
    return Object.keys(AUDIT_META).filter((a) => present.has(a))
  }, [logs])

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Immutable record of every change — who did what, and when."
        icon={ScrollText}
      >
        <button className="btn-ghost" onClick={doExport}><Download size={16} /> Export</button>
      </PageHeader>

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-400">
          <Filter size={13} /> Filters
        </span>
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search actor, target, summary…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value={ALL}>All actions</option>
          {actionOptions.map((a) => <option key={a} value={a}>{AUDIT_META[a].label}</option>)}
        </select>
        {filtersActive && (
          <button className="btn-ghost" onClick={clearFilters}><X size={15} /> Clear</button>
        )}
      </div>

      {loading ? (
        <EmptyState icon={ScrollText} title="Loading…" hint="Fetching the audit trail." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={logs.length ? 'No matches' : 'No activity yet'}
          hint={logs.length ? 'Try adjusting your filters.' : 'Changes will be recorded here as your team works.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-200/60">
                {filtered.map((l, i) => {
                  const m = auditMeta(l.action)
                  return (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      className="hover:bg-clay-100/50"
                      style={{ boxShadow: `inset 4px 0 0 ${m.color}` }}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{fmt(l.at)}</td>
                      <td className="px-4 py-3 font-medium text-ink-800">
                        {l.actorName}
                        {l.source === 'qr' && <span className="ml-1 text-[11px] text-ink-400">(QR)</span>}
                      </td>
                      <td className="px-4 py-3"><Badge color={m.color}>{m.label}</Badge></td>
                      <td className="px-4 py-3 text-ink-700">{l.targetLabel || '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{l.summary || '—'}</td>
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
