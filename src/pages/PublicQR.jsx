import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Flame, AlertTriangle, Truck, RefreshCw, ShieldCheck, MapPin, Calendar, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Spinner } from '../components/ui'
import ReportDefectModal from '../components/ReportDefectModal'
import { getExtinguisherByToken, createReport, createAssetReport } from '../lib/firestore'
import { toDate, deriveStatus, severityLabel, healthColor } from '../lib/extinguisherLogic'
import {
  STATUS, STATUS_LABEL, STATUS_COLOR,
  ASSET_DEFECTS, AED_STATUS_LABEL, AED_STATUS_COLOR, FAS_STATUS_LABEL, FAS_STATUS_COLOR,
} from '../lib/constants'
import CategoryBadges from '../components/CategoryBadges'

// ── Public view for a scanned AED / FAS asset (details + defect reporting) ────
function AssetView({ data }) {
  const isFas = data.assetKind === 'fas'
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherText, setOtherText] = useState('')
  const statusLabel = (isFas ? FAS_STATUS_LABEL : AED_STATUS_LABEL)[data.status] || data.status
  const statusColor = (isFas ? FAS_STATUS_COLOR : AED_STATUS_COLOR)[data.status] || '#64748b'
  const defects = ASSET_DEFECTS[data.assetKind] || []
  const fmt = (v) => { const d = toDate(v); return d ? format(d, 'dd MMM yyyy') : '—' }

  const report = async (defect) => {
    setBusy(true)
    try {
      await createAssetReport(data.orgId, {
        assetKind: data.assetKind, assetRefId: data.assetRefId, assetLabel: data.label, defect, token: data.token,
      })
      setDone(true)
      toast.success('Defect reported — pending review')
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="aurora min-h-screen px-4 py-8 text-white">
      <motion.div className="mx-auto w-full max-w-md" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-5 flex items-center justify-center gap-2">
          <span className="text-2xl">{isFas ? '🔔' : '❤️'}</span>
          <span className="text-lg font-extrabold tracking-tight">Fire Marshal</span>
        </div>
        <div className="rounded-3xl glass p-6">
          <div className="mb-4 text-center">
            <p className="text-xs uppercase tracking-wide text-white/50">{isFas ? 'Fire Alarm Device' : 'Defibrillator (AED)'}</p>
            <p className="text-3xl font-black">{data.label}</p>
            {isFas ? <p className="text-white/60">{data.deviceType}{data.zone ? ` · ${data.zone}` : ''}</p>
                   : <p className="text-white/60">{[data.brand, data.model].filter(Boolean).join(' ')}</p>}
          </div>
          <div className="mb-4 flex justify-center">
            <Badge color={statusColor} soft={false}>{statusLabel}</Badge>
          </div>
          <div className="space-y-2">
            {data.region && <Row icon={MapPin} label="Region" value={data.region} />}
            <Row icon={MapPin} label="Site" value={data.centerName} />
            {data.location && <Row icon={MapPin} label="Location" value={data.location} />}
            {isFas ? (
              <>
                <Row icon={Calendar} label="Last Service" value={fmt(data.lastService)} />
                <Row icon={Calendar} label="Next Service" value={fmt(data.nextService)} />
                {data.amcVendor && <Row icon={ShieldCheck} label="AMC Vendor" value={data.amcVendor} />}
              </>
            ) : (
              <>
                <Row icon={Calendar} label="Battery Expiry" value={fmt(data.batteryExpiry)} />
                <Row icon={Calendar} label="Pad Expiry" value={fmt(data.padExpiry)} />
                <Row icon={Calendar} label="Next Inspection" value={fmt(data.nextInspection)} />
              </>
            )}
          </div>

          {done ? (
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-center">
              <ShieldCheck size={22} className="mx-auto mb-1 text-green-300" />
              <p className="text-sm font-bold">Thanks — your report was submitted.</p>
              <p className="text-xs text-white/50">The {data.orgName || 'site'} team will review it.</p>
            </div>
          ) : (
            <div className="mt-6">
              <p className="mb-2 text-center text-sm font-semibold text-white/70">Report a defect</p>
              <div className="grid grid-cols-1 gap-2">
                {defects.map((d) => (
                  d === 'Other' ? (
                    <div key={d}>
                      <button className="btn w-full bg-white/10 text-white hover:bg-white/20" disabled={busy} onClick={() => setOtherOpen((v) => !v)}>
                        <AlertTriangle size={15} /> Other…
                      </button>
                      {otherOpen && (
                        <div className="mt-2 space-y-2">
                          <textarea className="w-full rounded-xl bg-white/10 p-3 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/15 focus:ring-white/40"
                            rows={2} maxLength={100} placeholder="Describe the defect (max 100 characters)…"
                            value={otherText} onChange={(e) => setOtherText(e.target.value)} />
                          <button className="btn-primary w-full" disabled={busy || !otherText.trim()}
                            onClick={() => report(otherText.trim().slice(0, 100))}>
                            {busy ? <Spinner size={18} /> : 'Submit report'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button key={d} className="btn w-full bg-white/10 text-white hover:bg-white/20" disabled={busy} onClick={() => report(d)}>
                      <AlertTriangle size={15} /> {d}
                    </button>
                  )
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-white/40">Reports are reviewed and approved in the {data.orgName || 'organization'} portal.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function Row({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
      <Icon size={18} className="text-white/50" />
      <span className="text-sm text-white/60">{label}</span>
      <span className="ml-auto text-sm font-bold" style={accent ? { color: accent } : { color: '#fff' }}>
        {value}
      </span>
    </div>
  )
}

export default function PublicQR() {
  const { token } = useParams()
  const [ext, setExt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const [busyAction, setBusyAction] = useState(null) // 'refill' | 'pickup' | null

  const load = async () => {
    setLoading(true)
    const data = await getExtinguisherByToken(token)
    setExt(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [token])

  const fmt = (v) => {
    const d = toDate(v)
    return d ? format(d, 'dd MMM yyyy') : '—'
  }

  const extLabel = () => (ext.serialNo ? `${ext.serialNo} · ${ext.type}` : `${ext.type} · ${ext.capacity}`)

  // Step 1: request a refill → on approval lands in "To Be Refilled".
  const requestRefill = async () => {
    setBusyAction('refill')
    try {
      await createReport(ext.orgId, {
        extId: ext.extId,
        extLabel: extLabel(),
        kind: 'status_change',
        newStatus: STATUS.TO_BE_REFILLED,
        note: 'Refill requested via QR scan',
        reportedBy: 'public',
        reportedByName: 'QR Scan (Public)',
        source: 'qr',
      })
      toast.success('Refill request submitted — pending approval')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyAction(null)
    }
  }

  // Step 2: vendor picked it up → on approval lands in "In Process of Refilling".
  const pickedUpByVendor = async () => {
    setBusyAction('pickup')
    try {
      await createReport(ext.orgId, {
        extId: ext.extId,
        extLabel: extLabel(),
        kind: 'status_change',
        newStatus: STATUS.IN_PROCESS_REFILLING,
        note: 'Picked up by vendor for refill (via QR scan)',
        reportedBy: 'public',
        reportedByName: 'QR Scan (Public)',
        source: 'qr',
      })
      toast.success('Vendor pickup submitted — pending approval')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyAction(null)
    }
  }

  if (loading) {
    return (
      <div className="aurora flex min-h-screen items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  if (!ext) {
    return (
      <div className="aurora flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <Flame size={48} className="text-brand-300" />
        <h1 className="text-2xl font-extrabold">QR code not recognized</h1>
        <p className="text-white/60">This extinguisher may have been removed.</p>
      </div>
    )
  }

  // AED / FAS assets share the /qr/:token route but render their own view.
  if (ext.assetKind === 'aed' || ext.assetKind === 'fas') return <AssetView data={ext} />

  const d = deriveStatus(ext)
  const accent = healthColor(ext)

  return (
    <div className="aurora min-h-screen px-4 py-8 text-white">
      <motion.div
        className="mx-auto w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-5 flex items-center justify-center gap-2">
          <span className="text-2xl">🔥</span>
          <span className="text-lg font-extrabold tracking-tight">Fire Marshal</span>
        </div>

        <div className="rounded-3xl glass p-6">
          {/* Health banner */}
          <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: `${accent}22` }}>
            <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ backgroundColor: accent }}>
              {d.isHealthy ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/50">Current condition</p>
              <p className="text-lg font-extrabold">{severityLabel(ext)}</p>
            </div>
          </div>

          <div className="mb-4 text-center">
            <p className="text-4xl font-black">{ext.type}</p>
            <p className="text-white/60">{ext.capacity} · Entity {ext.entity}</p>
            {ext.serialNo && <p className="mt-1 text-sm text-white/40">Serial {ext.serialNo}</p>}
          </div>

          <div className="mb-4 flex flex-wrap justify-center gap-1.5">
            <Badge color={STATUS_COLOR[ext.status]} soft={false}>{STATUS_LABEL[ext.status]}</Badge>
            <CategoryBadges ext={ext} />
          </div>

          <div className="space-y-2">
            {ext.region && <Row icon={MapPin} label="Region" value={ext.region} />}
            <Row icon={MapPin} label="Center" value={ext.centerName} />
            <Row icon={Calendar} label="Deployed" value={fmt(ext.dateOfDeployment)} />
            <Row icon={Calendar} label="Next Refill" value={fmt(ext.dateOfNextRefill)} accent={d.flags.REFILL_DUE ? '#fca5a5' : d.flags.REFILL_DUE_30 ? '#fcd34d' : undefined} />
            <Row icon={Calendar} label="Next HPT" value={fmt(ext.dateOfNextHPT)} accent={d.flags.HPT_DUE ? '#fca5a5' : d.flags.HPT_DUE_30 ? '#fcd34d' : undefined} />
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-2">
            <button className="btn-primary w-full" onClick={() => setReportOpen(true)}>
              <AlertTriangle size={16} /> Report a defect
            </button>
            <button className="btn w-full bg-white/10 text-white hover:bg-white/20" onClick={requestRefill} disabled={busyAction !== null}>
              {busyAction === 'refill' ? <Spinner size={18} /> : (<><RefreshCw size={16} /> Request refill</>)}
            </button>
            <button className="btn w-full bg-white/10 text-white hover:bg-white/20" onClick={pickedUpByVendor} disabled={busyAction !== null}>
              {busyAction === 'pickup' ? <Spinner size={18} /> : (<><Truck size={16} /> Picked up by vendor for refill</>)}
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-white/40">
            Submitted updates are reviewed and approved in the {ext.orgName || 'organization'} portal.
          </p>
        </div>
      </motion.div>

      <ReportDefectModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        ext={ext}
        orgId={ext.orgId}
        reporter={{ name: 'QR Scan (Public)' }}
        source="qr"
      />
    </div>
  )
}
