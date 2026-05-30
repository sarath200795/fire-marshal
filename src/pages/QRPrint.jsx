import { useMemo, useRef, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import { QRCodeCanvas } from 'qrcode.react'
import { QrCode, Printer, CheckSquare, Square } from 'lucide-react'
import { PageHeader, EmptyState } from '../components/ui'
import { useFleet } from '../context/FleetContext'
import { publicQrUrl } from '../lib/qr'

export default function QRPrint() {
  const { extinguishers } = useFleet()
  const location = useLocation()
  const printRef = useRef(null)

  const [selected, setSelected] = useState(() => new Set(location.state?.ids || []))

  // If navigated with preselected ids, keep them; otherwise default to all.
  useEffect(() => {
    if (location.state?.ids?.length) setSelected(new Set(location.state.ids))
  }, [location.state])

  const items = useMemo(
    () => extinguishers.filter((e) => selected.has(e.id)),
    [extinguishers, selected]
  )

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allOn = extinguishers.length > 0 && extinguishers.every((e) => selected.has(e.id))
  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(extinguishers.map((e) => e.id)))

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Fire-Marshal-QR-Codes',
  })

  return (
    <div>
      <PageHeader
        title="Print QR Codes"
        subtitle={`${items.length} selected for printing`}
        icon={QrCode}
      >
        <button className="btn-primary" onClick={handlePrint} disabled={!items.length}>
          <Printer size={16} /> Print {items.length || ''}
        </button>
      </PageHeader>

      {extinguishers.length === 0 ? (
        <EmptyState icon={QrCode} title="No extinguishers" hint="Add extinguishers to generate QR codes." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Selector */}
          <aside className="card h-fit p-4 lg:col-span-1 no-print">
            <button onClick={toggleAll} className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-ink-50">
              {allOn ? <CheckSquare size={16} className="text-brand-500" /> : <Square size={16} className="text-ink-400" />}
              Select all ({extinguishers.length})
            </button>
            <div className="max-h-[60vh] space-y-1 overflow-y-auto">
              {extinguishers.map((e) => {
                const on = selected.has(e.id)
                return (
                  <button
                    key={e.id}
                    onClick={() => toggle(e.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${on ? 'bg-brand-50 text-brand-700' : 'hover:bg-ink-50'}`}
                  >
                    {on ? <CheckSquare size={15} className="shrink-0 text-brand-500" /> : <Square size={15} className="shrink-0 text-ink-300" />}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{e.serialNo || e.type}</span>{' '}
                      <span className="text-ink-400">{e.centerName}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Printable grid */}
          <div className="lg:col-span-3">
            {items.length === 0 ? (
              <EmptyState icon={Printer} title="Nothing selected" hint="Pick extinguishers on the left to print their QR codes." />
            ) : (
              <div ref={printRef} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {items.map((e) => (
                  <div key={e.id} className="flex flex-col items-center rounded-2xl border border-ink-200 bg-white p-4 text-center">
                    <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-brand-600">🔥 Fire Marshal</div>
                    <QRCodeCanvas value={publicQrUrl(e.qrToken)} size={132} level="M" includeMargin />
                    <p className="mt-2 text-sm font-extrabold text-ink-900">{e.serialNo || '—'}</p>
                    <p className="text-xs text-ink-500">{e.type} · {e.capacity} · {e.entity}</p>
                    <p className="truncate text-xs text-ink-400">{e.centerName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
