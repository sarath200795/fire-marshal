import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Boxes, Search, Download, Trash2, QrCode, AlertTriangle, Filter, X, Pencil, CheckCircle2, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, Modal, Spinner, Badge } from '../components/ui'
import ExtinguisherTable from '../components/ExtinguisherTable'
import ReportDefectModal from '../components/ReportDefectModal'
import EditExtinguisherModal from '../components/EditExtinguisherModal'
import { useFleet } from '../context/FleetContext'
import { useAuth } from '../context/AuthContext'
import { deriveStatus, isToBeRefilled } from '../lib/extinguisherLogic'
import { exportExtinguishers } from '../lib/exporter'
import { bulkDeleteExtinguishers, markReceivedByVendor, resolveDefects } from '../lib/firestore'
import { TYPES, CAPACITIES, ENTITIES, REGIONS, STATUS, STATUS_LABEL, CATEGORY_LIST, PHYSICAL_DEFECT_KEYS } from '../lib/constants'

const ALL = '__all__'

export default function Repository() {
  const { extinguishers, org, capped, loadCap } = useFleet()
  const { orgId, orgName, profile } = useAuth()
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])

  const [search, setSearch] = useState('')
  const [type, setType] = useState(ALL)
  const [capacity, setCapacity] = useState(ALL)
  const [entity, setEntity] = useState(ALL)
  const [region, setRegion] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [activeCats, setActiveCats] = useState(new Set())
  const [selected, setSelected] = useState(new Set())
  const [reportFor, setReportFor] = useState(null)
  const [editFor, setEditFor] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState(null)

  // Inline workflow actions (reuse the same helpers as the dedicated pages).
  const sendToVendor = async (ext) => {
    setBusyId(ext.id)
    try {
      await markReceivedByVendor(orgId, orgName, ext.id, profile?.name)
      toast.success('Marked received by vendor — now In Process')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }
  const resolvePhysical = async (ext) => {
    setBusyId(ext.id)
    try {
      const remaining = (ext.physicalDefects || []).filter((k) => !PHYSICAL_DEFECT_KEYS.includes(k))
      await resolveDefects(orgId, orgName, ext.id, remaining, profile?.name)
      toast.success('Physical defects resolved')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return extinguishers.filter((e) => {
      if (q && !(`${e.serialNo} ${e.centerName} ${e.type}`.toLowerCase().includes(q))) return false
      if (type !== ALL && e.type !== type) return false
      if (capacity !== ALL && e.capacity !== capacity) return false
      if (entity !== ALL && e.entity !== entity) return false
      if (region !== ALL && e.region !== region) return false
      if (status !== ALL && e.status !== status) return false
      if (activeCats.size) {
        const cats = new Set(deriveStatus(e, today).categories)
        for (const c of activeCats) if (!cats.has(c)) return false
      }
      return true
    })
  }, [extinguishers, search, type, capacity, entity, region, status, activeCats, today])

  const toggleCat = (key) => {
    setActiveCats((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = (ids) =>
    setSelected((prev) => {
      const allOn = ids.every((id) => prev.has(id))
      return allOn ? new Set() : new Set(ids)
    })

  const selectedItems = filtered.filter((e) => selected.has(e.id))

  const doExport = () => {
    const list = selected.size ? selectedItems : filtered
    if (!list.length) return toast.error('Nothing to export')
    exportExtinguishers(list, `extinguishers-${Date.now()}.xlsx`, today)
    toast.success(`Exported ${list.length} rows`)
  }

  const doPrint = () => {
    const ids = selected.size ? Array.from(selected) : filtered.map((e) => e.id)
    navigate('/app/qr-print', { state: { ids } })
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      const items = selectedItems.map((e) => ({ id: e.id, qrToken: e.qrToken }))
      await bulkDeleteExtinguishers(orgId, items, { uid: profile?.uid, name: profile?.name })
      toast.success(`Deleted ${items.length} extinguishers`)
      setSelected(new Set())
      setConfirmDelete(false)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const clearFilters = () => {
    setSearch(''); setType(ALL); setCapacity(ALL); setEntity(ALL); setRegion(ALL); setStatus(ALL); setActiveCats(new Set())
  }
  const filtersActive = search || type !== ALL || capacity !== ALL || entity !== ALL || region !== ALL || status !== ALL || activeCats.size

  return (
    <div>
      <PageHeader title="Repository" subtitle={`${filtered.length} of ${extinguishers.length} extinguishers`} icon={Boxes}>
        <button className="btn-ghost" onClick={doExport}><Download size={16} /> Export</button>
        <button className="btn-ghost" onClick={doPrint}><QrCode size={16} /> Print QR</button>
      </PageHeader>

      {capped && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle size={16} />
          <span>Showing the most recent <strong>{loadCap.toLocaleString()}</strong> extinguishers. Your fleet is larger — paginated views are coming; for now, narrow with filters or export.</span>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search serial, center, type…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
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
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={ALL}>All statuses</option>
            {Object.values(STATUS).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {filtersActive && (
            <button className="btn-ghost" onClick={clearFilters}><X size={15} /> Clear</button>
          )}
        </div>

        {/* Color-coded condition chips */}
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-400">
            <Filter size={13} /> Condition
          </span>
          {CATEGORY_LIST.map((c) => {
            const on = activeCats.has(c.key)
            return (
              <button
                key={c.key}
                onClick={() => toggleCat(c.key)}
                className="chip transition"
                style={on ? { backgroundColor: c.color, color: '#fff' } : { backgroundColor: `${c.color}1a`, color: c.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: on ? '#fff' : c.color }} />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-ink-950 px-4 py-3 text-white"
          >
            <span className="font-bold">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button className="btn bg-white/10 text-white hover:bg-white/20" onClick={doExport}><Download size={15} /> Export</button>
              <button className="btn bg-white/10 text-white hover:bg-white/20" onClick={doPrint}><QrCode size={15} /> Print QR</button>
              <button className="btn-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete</button>
              <button className="btn bg-white/10 text-white hover:bg-white/20" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={extinguishers.length ? 'No matches' : 'No extinguishers yet'}
          hint={extinguishers.length ? 'Try adjusting your filters.' : 'Add one or bulk upload to get started.'}
        />
      ) : (
        <ExtinguisherTable
          items={filtered}
          today={today}
          selectable
          selectedIds={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          showActionBy
          renderActions={(ext) => {
            const d = deriveStatus(ext, today)
            const canResolve = d.hasPhysicalDefect && !d.isClosed
            const canSendToVendor = isToBeRefilled(ext, today) && !d.inProcess && !d.isClosed
            return (
              <>
                {canResolve && (
                  <button className="btn bg-green-600 px-2.5 py-1.5 text-xs text-white hover:bg-green-700" disabled={busyId === ext.id} onClick={() => resolvePhysical(ext)} title="Resolve physical defects">
                    <CheckCircle2 size={14} /> Resolve
                  </button>
                )}
                {canSendToVendor && (
                  <button className="btn-soft px-2.5 py-1.5 text-xs" disabled={busyId === ext.id} onClick={() => sendToVendor(ext)} title="Mark received by vendor (In Process)">
                    <Truck size={14} /> Send to vendor
                  </button>
                )}
                <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setEditFor(ext)} title="Edit details">
                  <Pencil size={14} />
                </button>
                <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setReportFor(ext)} title="Report defect">
                  <AlertTriangle size={14} />
                </button>
                <a className="btn-ghost px-2.5 py-1.5 text-xs" href={`/qr/${ext.qrToken}`} target="_blank" rel="noreferrer" title="Open public QR page">
                  <QrCode size={14} />
                </a>
              </>
            )
          }}
        />
      )}

      <ReportDefectModal
        open={!!reportFor}
        onClose={() => setReportFor(null)}
        ext={reportFor}
        orgId={orgId}
        reporter={{ uid: profile?.uid, name: profile?.name }}
        source="portal"
      />

      <EditExtinguisherModal
        open={!!editFor}
        onClose={() => setEditFor(null)}
        ext={editFor}
        orgId={orgId}
        orgName={org?.name || orgName}
        actor={{ uid: profile?.uid, name: profile?.name }}
      />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete extinguishers?">
        <p className="text-sm text-ink-600">
          This permanently deletes <strong>{selected.size}</strong> extinguisher(s) and their QR codes.
          This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          <button className="btn-danger" onClick={doDelete} disabled={deleting}>
            {deleting ? <Spinner size={18} /> : (<><Trash2 size={16} /> Delete {selected.size}</>)}
          </button>
        </div>
      </Modal>
    </div>
  )
}
