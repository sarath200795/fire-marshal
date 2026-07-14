import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, ShieldCheck, Wrench, AlertOctagon, CalendarClock, ArrowRight } from 'lucide-react'
import { PageHeader, EmptyState, Spinner } from '../components/ui'
import { useFleet } from '../context/FleetContext'
import { fasSummary, fasCondition } from '../lib/assetLogic'
import { FAS_STATUS_LABEL, FAS_STATUS_COLOR } from '../lib/constants'

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}><Icon size={20} /></div>
      <div className="min-w-0"><p className="text-2xl font-extrabold text-ink-900">{value}</p><p className="truncate text-xs font-semibold text-ink-500">{label}</p></div>
    </div>
  )
}

export default function FASDashboard() {
  const { fas, loading } = useFleet()
  const today = useMemo(() => new Date(), [])
  const s = useMemo(() => fasSummary(fas, today), [fas, today])

  const byType = useMemo(() => {
    const m = new Map()
    for (const a of fas) {
      const t = a.deviceType || 'Other'
      if (!m.has(t)) m.set(t, { type: t, total: 0, attention: 0 })
      const row = m.get(t); row.total++
      const c = fasCondition(a, today); if (c.due || c.expired) row.attention++
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total)
  }, [fas, today])

  const bySite = useMemo(() => {
    const m = new Map()
    for (const a of fas) {
      const site = a.centerName || 'Unassigned'
      if (!m.has(site)) m.set(site, { site, total: 0, attention: 0 })
      const row = m.get(site); row.total++
      const c = fasCondition(a, today); if (c.due || c.expired) row.attention++
    }
    return Array.from(m.values()).sort((a, b) => b.attention - a.attention || b.total - a.total)
  }, [fas, today])

  if (loading) return <div className="grid place-items-center py-20"><Spinner size={28} /></div>

  return (
    <div>
      <PageHeader title="FAS Dashboard" subtitle="Fire-alarm system health across all sites" icon={BellRing}>
        <Link to="/app/fas" className="btn-soft">Open FAS Repository <ArrowRight size={15} /></Link>
      </PageHeader>

      {fas.length === 0 ? (
        <EmptyState icon={BellRing} title="No FAS devices yet" hint="Add fire-alarm devices in the FAS Repository to see system health here."
          action={<Link to="/app/fas" className="btn-primary">Go to FAS Repository</Link>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Stat icon={BellRing} label="Total devices" value={s.total} color="#6366f1" />
            <Stat icon={ShieldCheck} label="Operational" value={s.operational} color="#16a34a" />
            <Stat icon={Wrench} label="Service due" value={s.due} color="#f59e0b" />
            <Stat icon={AlertOctagon} label="Faulty" value={s.faulty} color="#dc2626" />
            <Stat icon={CalendarClock} label="Service due ≤30d" value={s.serviceDue} color="#b45309" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card overflow-x-auto">
              <p className="border-b border-clay-200/60 px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-500">By device type</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-clay-200/60">
                  {byType.map((r) => (
                    <tr key={r.type} className="hover:bg-ink-50/70">
                      <td className="px-4 py-2.5 font-semibold text-ink-800">{r.type}</td>
                      <td className="px-4 py-2.5 text-center text-ink-600">{r.total}</td>
                      <td className="px-4 py-2.5 text-center">{r.attention > 0 ? <span className="font-bold text-amber-600">{r.attention} ⚠</span> : <span className="text-green-600">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card overflow-x-auto">
              <p className="border-b border-clay-200/60 px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-500">By site</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-clay-200/60">
                  {bySite.map((r) => (
                    <tr key={r.site} className="hover:bg-ink-50/70">
                      <td className="px-4 py-2.5 font-semibold text-ink-800">{r.site}</td>
                      <td className="px-4 py-2.5 text-center text-ink-600">{r.total}</td>
                      <td className="px-4 py-2.5 text-center">{r.attention > 0 ? <span className="font-bold text-amber-600">{r.attention} ⚠</span> : <span className="text-green-600">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-500">
            {Object.entries(FAS_STATUS_LABEL).map(([k, label]) => (
              <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FAS_STATUS_COLOR[k] }} /> {label}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
