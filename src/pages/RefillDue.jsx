import { useMemo, useState } from 'react'
import { RefreshCw, Truck, AlertTriangle, QrCode, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState } from '../components/ui'
import ExtinguisherTable from '../components/ExtinguisherTable'
import ReportDefectModal from '../components/ReportDefectModal'
import { useFleet } from '../context/FleetContext'
import { useAuth } from '../context/AuthContext'
import { markReceivedByVendor } from '../lib/firestore'
import { exportExtinguishers } from '../lib/exporter'

export default function RefillDue() {
  const { refillDue } = useFleet()
  const { orgId, orgName, profile } = useAuth()
  const today = useMemo(() => new Date(), [])
  const [reportFor, setReportFor] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const doExport = () => {
    if (!refillDue.length) return toast.error('Nothing to export')
    exportExtinguishers(refillDue, `to-be-refilled-${refillDue.length}.xlsx`, today)
    toast.success(`Exported ${refillDue.length} rows`)
  }

  const receive = async (ext) => {
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

  return (
    <div>
      <PageHeader
        title="To Be Refilled"
        subtitle="Extinguishers due for refill/HPT (within 30 days) or flagged empty / over-pressurized."
        icon={RefreshCw}
      >
        <button className="btn-ghost" onClick={doExport}><Download size={16} /> Export</button>
      </PageHeader>

      {refillDue.length === 0 ? (
        <EmptyState icon={RefreshCw} title="Nothing due" hint="No extinguishers currently need refilling. 🎉" />
      ) : (
        <ExtinguisherTable
          items={refillDue}
          today={today}
          renderActions={(ext) => (
            <>
              <button
                className="btn-soft px-2.5 py-1.5 text-xs"
                disabled={busyId === ext.id}
                onClick={() => receive(ext)}
              >
                <Truck size={14} /> Received by vendor
              </button>
              <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setReportFor(ext)} title="Report defect">
                <AlertTriangle size={14} />
              </button>
              <a className="btn-ghost px-2.5 py-1.5 text-xs" href={`/qr/${ext.qrToken}`} target="_blank" rel="noreferrer" title="Public QR">
                <QrCode size={14} />
              </a>
            </>
          )}
        />
      )}

      <ReportDefectModal
        open={!!reportFor}
        onClose={() => setReportFor(null)}
        ext={reportFor}
        orgId={orgId}
        reporter={{ uid: profile?.uid, name: profile?.name }}
      />
    </div>
  )
}
