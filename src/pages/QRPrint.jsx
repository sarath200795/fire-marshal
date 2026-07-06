import { useMemo, useRef, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Printer, CheckSquare, Square } from 'lucide-react'
import { PageHeader, EmptyState } from '../components/ui'
import ListFilters from '../components/ListFilters'
import { useFleet } from '../context/FleetContext'
import { publicQrUrl } from '../lib/qr'
import { emptyFilters, applyListFilters, hasActiveFilters } from '../lib/listFilter'

export default function QRPrint() {
  const { extinguishers } = useFleet()
  const location = useLocation()
  const printRef = useRef(null)

  const [selected, setSelected] = useState(() => new Set(location.state?.ids || []))
  const [filters, setFilters] = useState(emptyFilters())

  // If navigated with preselected ids, keep them; otherwise default to all.
  useEffect(() => {
    if (location.state?.ids?.length) setSelected(new Set(location.state.ids))
  }, [location.state])

  // The selector list is narrowed by the filter bar; the selection itself
  // persists across filter changes so a batch can be built from several filters.
  const filtered = useMemo(
    () => applyListFilters(extinguishers, filters),
    [extinguishers, filters]
  )
  const filtersActive = hasActiveFilters(filters)

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

  // "Select all" is scoped to the currently filtered rows (union / clear).
  const allOn = filtered.length > 0 && filtered.every((e) => selected.has(e.id))
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOn) filtered.forEach((e) => next.delete(e.id))
      else filtered.forEach((e) => next.add(e.id))
      return next
    })

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Fire-Marshal-QR-Codes',
    // Duplicate the @page + grid rules so they also apply inside the print iframe.
    pageStyle: `
      @page { size: A4; margin: 12mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .qr-print-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 8mm !important; }
        .qr-print-card { break-inside: avoid; page-break-inside: avoid; min-height: 46mm; box-shadow: none !important; }
        /* Vector QR at a fixed physical size so it prints crisp and scannable. */
        .qr-print-code { width: 34mm !important; height: 34mm !important; }
      }
    `,
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
        <>
        {/* Filter bar (client-side) — narrows the selector below */}
        <div className="no-print">
          <ListFilters
            filters={filters}
            onChange={setFilters}
            showStatus
            searchPlaceholder="Search serial, center or type…"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Selector */}
          <aside className="card h-fit p-4 lg:col-span-1 no-print">
            <button onClick={toggleAll} disabled={!filtered.length} className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-ink-50 disabled:opacity-40">
              {allOn ? <CheckSquare size={16} className="text-brand-500" /> : <Square size={16} className="text-ink-400" />}
              Select all ({filtered.length}{filtersActive ? ` of ${extinguishers.length}` : ''})
            </button>
            <p className="mb-2 px-2 text-xs text-ink-400">{selected.size} selected for printing</p>
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-ink-400">
                No matches. <button className="font-semibold text-brand-600 hover:underline" onClick={() => setFilters(emptyFilters())}>Clear filters</button>
              </p>
            ) : (
              <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                {filtered.map((e) => {
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
            )}
          </aside>

          {/* Printable grid */}
          <div className="lg:col-span-3">
            {items.length === 0 ? (
              <EmptyState icon={Printer} title="Nothing selected" hint="Pick extinguishers on the left to print their QR codes." />
            ) : (
              <div ref={printRef} className="qr-print-grid grid grid-cols-2 gap-4 sm:grid-cols-3">
                {items.map((e) => (
                  <div key={e.id} className="qr-print-card flex flex-col items-center rounded-2xl border border-ink-200 bg-white p-4 text-center">
                    <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-brand-600">🔥 Fire Marshal</div>
                    <QRCodeSVG
                      className="qr-print-code"
                      value={publicQrUrl(e.qrToken)}
                      size={148}
                      level="H"
                      includeMargin
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                    <p className="mt-2 text-sm font-extrabold text-ink-900">{e.serialNo || '—'}</p>
                    <p className="text-xs text-ink-500">{e.type} · {e.capacity} · {e.entity}</p>
                    <p className="truncate text-xs text-ink-400">{e.centerName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  )
}
