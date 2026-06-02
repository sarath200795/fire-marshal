import { Search, Filter, X } from 'lucide-react'
import { TYPES, CAPACITIES, ENTITIES, REGIONS, STATUS, STATUS_LABEL, PHYSICAL_DEFECT_KEYS, DEFECT_BY_KEY } from '../lib/constants'
import { FILTER_ALL, hasActiveFilters } from '../lib/listFilter'

const OPTIONS = {
  type: { label: 'types', values: TYPES },
  capacity: { label: 'capacities', values: CAPACITIES },
  entity: { label: 'entities', values: ENTITIES },
  region: { label: 'regions', values: REGIONS },
}

/**
 * Reusable client-side filter bar for extinguisher list pages.
 *
 * Props:
 *  - filters: the current filter object (see lib/listFilter emptyFilters)
 *  - onChange(next): called with the updated filter object
 *  - fields: which attribute dropdowns to show (default type/capacity/entity/region)
 *  - showStatus: also render the lifecycle Status dropdown (Repository only)
 *  - showDefect: render a physical-defect dropdown (PhysicalDefectLog)
 *  - searchPlaceholder: input placeholder
 *  - children: extra controls (e.g. Repository's condition chips) on a 2nd row
 */
export default function ListFilters({
  filters,
  onChange,
  fields = ['type', 'capacity', 'entity', 'region'],
  showStatus = false,
  showDefect = false,
  searchPlaceholder = 'Search serial, center or type…',
  children,
}) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value })
  const clear = () =>
    onChange({ ...filters, search: '', type: FILTER_ALL, capacity: FILTER_ALL, entity: FILTER_ALL, region: FILTER_ALL, status: FILTER_ALL, defect: FILTER_ALL })

  return (
    <div className="card mb-4 space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-400">
          <Filter size={13} /> Filters
        </span>
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder={searchPlaceholder}
            value={filters.search || ''}
            onChange={set('search')}
          />
        </div>

        {showDefect && (
          <select className="input w-auto" value={filters.defect || FILTER_ALL} onChange={set('defect')}>
            <option value={FILTER_ALL}>All defects</option>
            {PHYSICAL_DEFECT_KEYS.map((k) => <option key={k} value={k}>{DEFECT_BY_KEY[k].label}</option>)}
          </select>
        )}

        {fields.map((f) => (
          <select key={f} className="input w-auto" value={filters[f] || FILTER_ALL} onChange={set(f)}>
            <option value={FILTER_ALL}>All {OPTIONS[f].label}</option>
            {OPTIONS[f].values.map((v) => <option key={v}>{v}</option>)}
          </select>
        ))}

        {showStatus && (
          <select className="input w-auto" value={filters.status || FILTER_ALL} onChange={set('status')}>
            <option value={FILTER_ALL}>All statuses</option>
            {Object.values(STATUS).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        )}

        {hasActiveFilters(filters) && (
          <button className="btn-ghost" onClick={clear}><X size={15} /> Clear</button>
        )}
      </div>

      {children}
    </div>
  )
}
