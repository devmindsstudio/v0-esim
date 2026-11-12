/**
 * Shared date-range type + matcher for the admin dashboard filters.
 *
 * The dashboard's From/To/Year/Month strip produces a { from, to } range; the
 * data helpers (KPI cards, revenue chart, leaderboard) filter their rows through
 * `withinRange` so the whole dashboard responds to the selected period. Kept
 * dependency-free (no Supabase) so both client libs can import it.
 */

export interface DashboardRange {
  from?: Date
  to?: Date
}

/** Whether a range actually constrains anything (at least one bound set). */
export function isRangeActive(range?: DashboardRange): boolean {
  return !!(range && (range.from || range.to))
}

/**
 * True if an ISO timestamp falls within [from 00:00:00, to 23:59:59.999] using
 * the viewer's local day boundaries (the calendar/Year+Month picks are local).
 * Missing bounds are open-ended; an inactive range matches everything.
 */
export function withinRange(iso: string | null | undefined, range?: DashboardRange): boolean {
  if (!isRangeActive(range)) return true
  if (!iso) return false

  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false

  if (range!.from) {
    const start = new Date(range!.from)
    start.setHours(0, 0, 0, 0)
    if (t < start.getTime()) return false
  }
  if (range!.to) {
    const end = new Date(range!.to)
    end.setHours(23, 59, 59, 999)
    if (t > end.getTime()) return false
  }
  return true
}
