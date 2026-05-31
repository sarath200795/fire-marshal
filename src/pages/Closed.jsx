import { useMemo } from 'react'
import { CheckCircle2, QrCode, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState } from '../components/ui'
import ExtinguisherTable from '../components/ExtinguisherTable'
import { useFleet } from '../context/FleetContext'
import { exportExtinguishers } from '../lib/exporter'

export default function Closed() {
  const { closed } = useFleet()
  const today = useMemo(() => new Date(), [])

  const doExport = () => {
    if (!closed.length) return toast.error('Nothing to export')
    exportExtinguishers(closed, `refilled-closed-${closed.length}.xlsx`, today)
    toast.success(`Exported ${closed.length} rows`)
  }

  return (
    <div>
      <PageHeader
        title="Refilled & Closed"
        subtitle="Completed refill cycles with updated due dates."
        icon={CheckCircle2}
      >
        <button className="btn-ghost" onClick={doExport}><Download size={16} /> Export</button>
      </PageHeader>

      {closed.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No closed cycles yet" hint="Completed refills will be recorded here." />
      ) : (
        <ExtinguisherTable
          items={closed}
          today={today}
          showDefectChips={false}
          showActionBy
          renderActions={(ext) => (
            <a className="btn-ghost px-2.5 py-1.5 text-xs" href={`/qr/${ext.qrToken}`} target="_blank" rel="noreferrer" title="Public QR">
              <QrCode size={14} />
            </a>
          )}
        />
      )}
    </div>
  )
}
