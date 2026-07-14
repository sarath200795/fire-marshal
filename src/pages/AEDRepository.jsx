import { useMemo, useState, useEffect } from 'react'
import { HeartPulse, Plus, Pencil, Trash2, Search, Filter, X, Download, QrCode, Wrench } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, Modal, Badge, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { addAed, updateAed, deleteAed, serviceAed } from '../lib/firestore'
import { exportRows } from '../lib/exporter'
import { publicQrUrl } from '../lib/qr'
import { format } from 'date-fns'
import { dueState, aedColor } from '../lib/assetLogic'
import { toDate } from '../lib/extinguisherLogic'
import { REGIONS, ENTITIES, AED_STATUS, AED_STATUS_LABEL, AED_STATUS_COLOR } from '../lib/constants'

// Build site → {region, entity} from existing records so AED sites auto-fill.
function useSiteMeta() {
  const { extinguishers, signages, aeds, fas } = useFleet()
  return useMemo(() => {
    const m = {}
    const add = (rows) => rows.forEach((r) => {
      const s = r.centerName
      if (!s) return
      if (!m[s]) m[s] = { region: '', entity: '' }
      if (!m[s].region && r.region) m[s].region = r.region
      if (!m[s].entity && r.entity) m[s].entity = r.entity
    })
    add(extinguishers || []); add(signages || []); add(aeds || []); add(fas || [])
    return m
  }, [extinguishers, signages, aeds, fas])
}

const fmtDate = (v) => { const d = toDate(v); return d ? format(d, 'dd MMM yyyy') : String(v || '') }

const EMPTY = {
  assetId: '', brand: '', model: '', centerName: '', region: '', entity: '', location: '',
  status: AED_STATUS.READY, installDate: '', batteryExpiry: '', padExpiry: '',
  lastInspection: '', nextInspection: '', notes: '',
}
const PAGE_SIZE = 20
const STATUSES = Object.values(AED_STATUS)

function Field({ label, children }) {
  return <div><label className="label">{label}</label>{children}</div>
}
function ChipRow({ label, options, selected, onToggle, render }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
      <span className="w-16 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-400">{label}</span>
      {options.map((opt) => {
        const on = selected.includes(opt)
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)}
            className={`chip transition ${on ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
            {render ? render(opt) : opt}
          </button>
        )
      })}
    </div>
  )
}
// Date cell that highlights when a date is expired / due soon.
function DateCell({ value }) {
  const s = dueState(value)
  if (!value) return <span className="text-ink-300">—</span>
  const color = s === 'expired' ? '#dc2626' : s === 'due' ? '#f59e0b' : '#64748b'
  return <span style={{ color }} className="font-medium">{fmtDate(value)}</span>
}

export default function AEDRepository() {
  const { orgId, orgName, profile } = useAuth()
  const { aeds, sites, loading } = useFleet()
  const siteMeta = useSiteMeta()
  const today = useMemo(() => new Date(), [])

  const [f, setF] = useState({ search: '', regions: [], entities: [], statuses: [] })
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [qrFor, setQrFor] = useState(null)
  const [serviceFor, setServiceFor] = useState(null)
  const [nextDate, setNextDate] = useState('')
  const [busy, setBusy] = useState(false)

  // Picking a known site fills its region + entity (from the already-created sites).
  const onSite = (v) => setEditing((e) => {
    const meta = siteMeta[v.trim()]
    return { ...e, centerName: v, ...(meta ? { region: meta.region || e.region, entity: meta.entity || e.entity } : {}) }
  })

  const toggle = (field, v) => setF((p) => ({ ...p, [field]: p[field].includes(v) ? p[field].filter((x) => x !== v) : [...p[field], v] }))
  const anyActive = f.search || f.regions.length || f.entities.length || f.statuses.length
  const clear = () => setF({ search: '', regions: [], entities: [], statuses: [] })

  const visible = useMemo(() => {
    const q = f.search.trim().toLowerCase()
    return aeds.filter((a) => {
      if (f.regions.length && !f.regions.includes(a.region)) return false
      if (f.entities.length && !f.entities.includes(a.entity)) return false
      if (f.statuses.length && !f.statuses.includes(a.status)) return false
      if (q && !`${a.assetId} ${a.brand} ${a.model} ${a.centerName} ${a.location}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [aeds, f])

  useEffect(() => { setPage(1) }, [f])
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const save = async (e) => {
    e.preventDefault()
    if (!editing.centerName.trim()) return toast.error('Site (center name) is required')
    setBusy(true)
    try {
      const actor = { uid: profile?.uid, name: profile?.name }
      if (editing.id) { await updateAed(orgId, orgName, editing.id, editing, actor); toast.success('AED updated') }
      else { await addAed(orgId, orgName, editing, actor); toast.success('AED added') }
      setEditing(null)
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }
  const confirmDelete = async () => {
    try {
      await deleteAed(orgId, removing.id, removing.qrToken, { uid: profile?.uid, name: profile?.name }, `${removing.assetId || 'AED'} @ ${removing.centerName}`)
      toast.success('AED deleted')
    } catch (err) { toast.error(err.message) } finally { setRemoving(null) }
  }
  const openService = (a) => { setServiceFor(a); setNextDate(a.nextInspection || '') }
  const confirmService = async () => {
    setBusy(true)
    try {
      await serviceAed(orgId, orgName, serviceFor, nextDate, { uid: profile?.uid, name: profile?.name })
      toast.success('Inspection logged')
      setServiceFor(null)
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }
  const doExport = () => {
    if (!visible.length) return toast.error('Nothing to export')
    exportRows(visible.map((a) => ({
      'Asset ID': a.assetId, Brand: a.brand, Model: a.model, Site: a.centerName, Region: a.region,
      Entity: a.entity, Location: a.location, Status: AED_STATUS_LABEL[a.status] || a.status,
      'Install Date': a.installDate, 'Battery Expiry': a.batteryExpiry, 'Pad Expiry': a.padExpiry,
      'Last Inspection': a.lastInspection, 'Next Inspection': a.nextInspection, Notes: a.notes,
    })), 'AED', 'fire-marshal-aed.xlsx')
    toast.success('Exported to Excel')
  }
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value })

  return (
    <div>
      <PageHeader title="AED Repository" subtitle={`${visible.length}${anyActive ? ` of ${aeds.length}` : ''} defibrillator${visible.length === 1 ? '' : 's'}`} icon={HeartPulse}>
        <button className="btn-soft" onClick={doExport} disabled={!aeds.length}><Download size={16} /> Export</button>
        <button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}><Plus size={16} /> Add AED</button>
      </PageHeader>

      {!loading && aeds.length > 0 && (
        <div className="card mb-4 space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-400"><Filter size={13} /> Filters</span>
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-9" placeholder="Search asset ID, brand, site…" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
            </div>
            {anyActive ? <button className="btn-ghost" onClick={clear}><X size={15} /> Clear</button> : null}
          </div>
          <ChipRow label="Region" options={REGIONS} selected={f.regions} onToggle={(v) => toggle('regions', v)} />
          <ChipRow label="Entity" options={ENTITIES} selected={f.entities} onToggle={(v) => toggle('entities', v)} />
          <ChipRow label="Status" options={STATUSES} selected={f.statuses} onToggle={(v) => toggle('statuses', v)} render={(s) => AED_STATUS_LABEL[s]} />
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20"><Spinner size={28} /></div>
      ) : aeds.length === 0 ? (
        <EmptyState icon={HeartPulse} title="No AEDs yet" hint="Add your first defibrillator to start tracking battery, pad and inspection due dates."
          action={<button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}><Plus size={16} /> Add AED</button>} />
      ) : visible.length === 0 ? (
        <EmptyState icon={Filter} title="No matches" hint="Try adjusting the filters." action={<button className="btn-ghost" onClick={clear}><X size={15} /> Clear filters</button>} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-clay-100/70 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Asset ID</th><th className="px-4 py-3">Site</th><th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Battery Exp</th><th className="px-4 py-3">Pad Exp</th><th className="px-4 py-3">Next Inspection</th>
                  <th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-200/60">
                {pageItems.map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50/70" style={{ boxShadow: `inset 4px 0 0 ${aedColor(a, today)}` }}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-ink-900">{a.assetId || '—'}</div>
                      <div className="text-xs text-ink-500">{[a.brand, a.model].filter(Boolean).join(' ') || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{a.centerName}{a.location ? <span className="block text-xs text-ink-400">{a.location}</span> : null}</td>
                    <td className="px-4 py-3 text-ink-600">{a.region || '—'}</td>
                    <td className="px-4 py-3"><DateCell value={a.batteryExpiry} /></td>
                    <td className="px-4 py-3"><DateCell value={a.padExpiry} /></td>
                    <td className="px-4 py-3"><DateCell value={a.nextInspection} /></td>
                    <td className="px-4 py-3"><Badge color={AED_STATUS_COLOR[a.status] || '#64748b'}>{AED_STATUS_LABEL[a.status] || a.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button className="btn bg-green-600 px-2 py-1.5 text-xs text-white hover:bg-green-700" onClick={() => openService(a)} title="Log inspection / service"><Wrench size={14} /></button>
                        {a.qrToken && <button className="btn-soft px-2 py-1.5" onClick={() => setQrFor(a)} title="View QR code"><QrCode size={15} /></button>}
                        <button className="btn-soft px-2 py-1.5" onClick={() => setEditing(a)} title="Edit"><Pencil size={15} /></button>
                        <button className="btn-soft px-2 py-1.5 text-red-600" onClick={() => setRemoving(a)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-ink-500">Showing <strong>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, visible.length)}</strong> of <strong>{visible.length}</strong></span>
            {pageCount > 1 && (
              <div className="flex items-center gap-1.5">
                <button className="btn-ghost px-3 py-1.5" onClick={() => setPage(safePage - 1)} disabled={safePage === 1}>Prev</button>
                <span className="px-2 font-semibold text-ink-700">Page {safePage} / {pageCount}</span>
                <button className="btn-ghost px-3 py-1.5" onClick={() => setPage(safePage + 1)} disabled={safePage === pageCount}>Next</button>
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit AED' : 'Add AED'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Asset ID / Serial"><input className="input" value={editing.assetId} onChange={set('assetId')} placeholder="e.g. AED-001" /></Field>
              <Field label="Site / Center name *">
                <input className="input" list="aed-sites" value={editing.centerName} onChange={(e) => onSite(e.target.value)} placeholder="e.g. Tower B - Lobby" required />
                <datalist id="aed-sites">{sites.map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="Brand"><input className="input" value={editing.brand} onChange={set('brand')} placeholder="e.g. Philips" /></Field>
              <Field label="Model"><input className="input" value={editing.model} onChange={set('model')} placeholder="e.g. HeartStart FRx" /></Field>
              <Field label="Region"><select className="input" value={editing.region} onChange={set('region')}><option value="">—</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
              <Field label="Entity"><select className="input" value={editing.entity} onChange={set('entity')}><option value="">—</option>{ENTITIES.map((en) => <option key={en}>{en}</option>)}</select></Field>
              <Field label="Location / placement"><input className="input" value={editing.location} onChange={set('location')} placeholder="e.g. Reception wall cabinet" /></Field>
              <Field label="Status"><select className="input" value={editing.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s} value={s}>{AED_STATUS_LABEL[s]}</option>)}</select></Field>
              <Field label="Install date"><input type="date" className="input" value={editing.installDate} onChange={set('installDate')} /></Field>
              <Field label="Battery expiry"><input type="date" className="input" value={editing.batteryExpiry} onChange={set('batteryExpiry')} /></Field>
              <Field label="Pad expiry"><input type="date" className="input" value={editing.padExpiry} onChange={set('padExpiry')} /></Field>
              <Field label="Last inspection"><input type="date" className="input" value={editing.lastInspection} onChange={set('lastInspection')} /></Field>
              <Field label="Next inspection"><input type="date" className="input" value={editing.nextInspection} onChange={set('nextInspection')} /></Field>
            </div>
            <Field label="Notes"><textarea className="input" rows={2} value={editing.notes} onChange={set('notes')} /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? <Spinner size={16} /> : (editing.id ? 'Save changes' : 'Add AED')}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Delete AED?">
        <p className="text-sm text-ink-600">Remove <span className="font-semibold">{removing?.assetId || 'this AED'}</span> at <span className="font-semibold">{removing?.centerName}</span>? This can't be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn-danger" onClick={confirmDelete}>Delete</button>
        </div>
      </Modal>

      <Modal open={!!qrFor} onClose={() => setQrFor(null)} title={`QR — ${qrFor?.assetId || 'AED'}`}>
        {qrFor && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-2xl bg-white p-4 shadow-clay"><QRCodeSVG value={publicQrUrl(qrFor.qrToken)} size={200} level="H" includeMargin /></div>
            <p className="text-sm font-bold text-ink-900">{qrFor.assetId || 'AED'} · {qrFor.centerName}</p>
            <p className="break-all text-xs text-ink-400">{publicQrUrl(qrFor.qrToken)}</p>
            <p className="text-xs text-ink-500">Scanning opens a public status page where anyone can report a defect.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!serviceFor} onClose={() => setServiceFor(null)} title="Log inspection / service">
        {serviceFor && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">Record an inspection for <strong>{serviceFor.assetId || 'this AED'}</strong> @ <strong>{serviceFor.centerName}</strong>. Last inspection is set to today and status to <strong>Ready</strong>.</p>
            <Field label="Next inspection due"><input type="date" className="input" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setServiceFor(null)}>Cancel</button>
              <button className="btn-primary" onClick={confirmService} disabled={busy}>{busy ? <Spinner size={16} /> : 'Log inspection'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
