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

/**
 * Filter a list of extinguisher-shaped rows by the given filters. Equality on
 * each set field (skipped when FILTER_ALL/blank); search over serial/center/type.
 * `status` and `defect` are only enforced when present in `filters`.
 * Pure + deterministic — unit-tested.
 */
export function applyListFilters(items = [], filters = {}) {
  const q = (filters.search || '').trim().toLowerCase()
  return items.filter((item) => {
    if (q && !matchesSearch(item, q)) return false
    if (filters.type && filters.type !== FILTER_ALL && item.type !== filters.type) return false
    if (filters.capacity && filters.capacity !== FILTER_ALL && item.capacity !== filters.capacity) return false
    if (filters.entity && filters.entity !== FILTER_ALL && item.entity !== filters.entity) return false
    if (filters.region && filters.region !== FILTER_ALL && item.region !== filters.region) return false
    if (filters.status && filters.status !== FILTER_ALL && item.status !== filters.status) return false
    if (filters.defect && filters.defect !== FILTER_ALL && item.defectType !== filters.defect) return false
    return true
  })
}
