// ─────────────────────────────────────────────────────────────────────────────
// Shared client-side filtering for extinguisher list pages. Every list page
// holds its full array in memory (from useFleet), so filtering is a pure
// Array.filter — no Firestore queries, no composite-index combinatorics. Used
// by Repository + all workflow lists via the <ListFilters> bar.
// ─────────────────────────────────────────────────────────────────────────────

export const FILTER_ALL = '__all__'

/** A blank filter state. `status`/`defect` are optional per page. */
export function emptyFilters() {
  return { search: '', type: FILTER_ALL, capacity: FILTER_ALL, entity: FILTER_ALL, region: FILTER_ALL, status: FILTER_ALL, defect: FILTER_ALL }
}

/** True when any filter is narrowing the set. */
export function hasActiveFilters(f = {}) {
  if (f.search && f.search.trim()) return true
  return ['type', 'capacity', 'entity', 'region', 'status', 'defect'].some(
    (k) => f[k] && f[k] !== FILTER_ALL,
  )
}

const matchesSearch = (item, q) =>
  `${item.serialNo || ''} ${item.centerName || ''} ${item.type || ''}`.toLowerCase().includes(q)

// Normalize a value for tolerant equality: trim + collapse inner whitespace +
// lowercase. This makes the dropdowns match stored values even when older or
// bulk-imported records drifted in case/spacing (e.g. "north", "5 KG", "ABC ").
const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

// True when the stored field equals the selected filter value (tolerant), or
// the filter is unset / FILTER_ALL.
const eq = (filterVal, itemVal) =>
  !filterVal || filterVal === FILTER_ALL || norm(itemVal) === norm(filterVal)

/**
 * Filter a list of extinguisher-shaped rows by the given filters. Tolerant
 * equality on each set field (skipped when FILTER_ALL/blank); search over
 * serial/center/type. `status` and `defect` are only enforced when present.
 * Pure + deterministic — unit-tested.
 */
export function applyListFilters(items = [], filters = {}) {
  const q = (filters.search || '').trim().toLowerCase()
  return items.filter((item) => {
    if (q && !matchesSearch(item, q)) return false
    if (!eq(filters.type, item.type)) return false
    if (!eq(filters.capacity, item.capacity)) return false
    if (!eq(filters.entity, item.entity)) return false
    if (!eq(filters.region, item.region)) return false
    if (!eq(filters.status, item.status)) return false
    if (!eq(filters.defect, item.defectType)) return false
    return true
  })
}
