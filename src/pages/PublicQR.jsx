import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Flame, AlertTriangle, Truck, RefreshCw, ShieldCheck, MapPin, Calendar, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Spinner } from '../components/ui'
import ReportDefectModal from '../components/ReportDefectModal'
import { getExtinguisherByToken, createReport } from '../lib/firestore'
import { toDate, deriveStatus, severityLabel, healthColor } from '../lib/extinguisherLogic'
import { STATUS, STATUS_LABEL, STATUS_COLOR } from '../lib/constants'
import CategoryBadges from '../components/CategoryBadges'

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
