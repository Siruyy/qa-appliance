/**
 * Shared client-side filtering, searching, and pagination utilities.
 * Used by Zustand store `filteredX()` methods to avoid repeated logic.
 */

/** Case-insensitive multi-field search. Returns true if any field contains the query. */
export function matchesSearch<T>(
  item: T,
  fields: (keyof T)[],
  query: string
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some((field) => {
    const val = item[field];
    if (val == null) return false;
    return String(val).toLowerCase().includes(q);
  });
}

/** Check whether an ISO date string (YYYY-MM-DD) falls within an optional range. */
export function matchesDateRange(
  dateStr: string | null | undefined,
  from: string,
  to: string
): boolean {
  if (!dateStr) return true;
  // Normalize to date-only (first 10 chars) for safe lexicographic comparison
  const d = dateStr.slice(0, 10);
  if (from && d < from.slice(0, 10)) return false;
  if (to && d > to.slice(0, 10)) return false;
  return true;
}

/** Slice an array for client-side pagination. Returns { items, total }. */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; total: number } {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
  };
}
