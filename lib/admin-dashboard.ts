'use client'

import { createClient } from '@/lib/supabase/client'
import { withinRange, isRangeActive, type DashboardRange } from '@/lib/dashboard-range'

/* ---- per-distributor aggregates (leaderboard + at-risk) ---- */
export interface DistributorAgg {
  id: string
  name: string
  company: string
  walletBalance: number
  esims: number
  revenue: number
  lastSale: string | null
}

export async function getDistributorAggregates(
  range?: DashboardRange,
): Promise<DistributorAgg[]> {
  const supabase = createClient()

  const { data: dists } = await supabase.from('distributors').select('id, name, company')
  const rows = dists ?? []
  const ids = rows.map((r) => r.id)

  const balByDist = new Map<string, number>()
  if (ids.length) {
    const { data: ws } = await supabase
      .from('wallets')
      .select('distributor_id, balance')
      .in('distributor_id', ids)
    for (const w of ws ?? []) balByDist.set(w.distributor_id, Number(w.balance ?? 0))
  }

  const { data: orders } = await supabase.from('orders').select('distributor_id, total, created_at')
  // eSIMs / revenue / last-sale reflect the selected period; wallet balance is
  // always the current balance.
  const agg = new Map<string, { esims: number; revenue: number; lastSale: string | null }>()
  for (const o of orders ?? []) {
    if (!withinRange(o.created_at, range)) continue
    const cur = agg.get(o.distributor_id) ?? { esims: 0, revenue: 0, lastSale: null }
    cur.esims += 1
    cur.revenue += Number(o.total ?? 0)
    if (!cur.lastSale || o.created_at > cur.lastSale) cur.lastSale = o.created_at
    agg.set(o.distributor_id, cur)
  }

  return rows.map((r) => {
    const a = agg.get(r.id) ?? { esims: 0, revenue: 0, lastSale: null }
    return {
      id: r.id,
      name: r.name,
      company: r.company ?? '',
      walletBalance: balByDist.get(r.id) ?? 0,
      esims: a.esims,
      revenue: a.revenue,
      lastSale: a.lastSale,
    }
  })
}

export function topDistributors(aggs: DistributorAgg[], n = 10): DistributorAgg[] {
  return [...aggs].sort((a, b) => b.revenue - a.revenue).slice(0, n)
}

/** At risk = holds credit (> $10) but hasn't sold anything. */
export function countAtRisk(aggs: DistributorAgg[]): number {
  return aggs.filter((d) => d.walletBalance > 10 && d.esims === 0).length
}

/* ---- revenue / volume time series ---- */
export interface RevenuePoint {
  date: string
  revenue: number
  esimsSold: number
}

/** Bucketing granularity for the revenue chart's Day/Week/Month tabs. */
export type SeriesPeriod = 'day' | 'week' | 'month'

/** Safety cap on how many buckets we ever emit (protects against odd ranges). */
const MAX_BUCKETS = 800

function dayKey(d: Date): string {
  // Local YYYY-MM-DD.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing `d` (local). */
function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // 0=Sun → back to Monday
  return x
}

/** The bucket key an order falls into, for the chosen granularity. */
function bucketKey(d: Date, period: SeriesPeriod): string {
  if (period === 'day') return dayKey(d)
  if (period === 'week') return dayKey(startOfWeek(d))
  return dayKey(new Date(d.getFullYear(), d.getMonth(), 1)) // month → 1st
}

/** Advance `d` by one bucket in place. */
function stepBucket(d: Date, period: SeriesPeriod): void {
  if (period === 'day') d.setDate(d.getDate() + 1)
  else if (period === 'week') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
}

/**
 * Revenue + volume series bucketed by day / week / month.
 *
 * With a `range` set the series spans [from, to]; otherwise it shows a trailing
 * window sized to the granularity (≈30 days / 12 weeks / 12 months). Empty
 * buckets are emitted as zero so the line stays continuous.
 */
export async function getRevenueSeries(
  range?: DashboardRange,
  period: SeriesPeriod = 'day',
): Promise<RevenuePoint[]> {
  const supabase = createClient()
  const { data: orders } = await supabase.from('orders').select('total, created_at')

  // Window: explicit range wins, else a trailing window sized to the period.
  let start: Date
  const end = new Date()
  if (isRangeActive(range) && range?.from && range?.to) {
    start = new Date(range.from)
    end.setTime(new Date(range.to).getTime())
  } else if (period === 'day') {
    start = new Date()
    start.setDate(end.getDate() - 29) // ≈ last 30 days
  } else if (period === 'week') {
    start = new Date()
    start.setDate(end.getDate() - 7 * 11) // ≈ last 12 weeks
  } else {
    start = new Date()
    start.setMonth(end.getMonth() - 11) // last 12 months
  }
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999) // include the whole end day

  // Aggregate orders that fall inside the window into their buckets.
  const agg = new Map<string, { revenue: number; esims: number }>()
  for (const o of orders ?? []) {
    const t = new Date(o.created_at)
    if (t.getTime() < start.getTime() || t.getTime() > end.getTime()) continue
    const key = bucketKey(t, period)
    const cur = agg.get(key) ?? { revenue: 0, esims: 0 }
    cur.revenue += Number(o.total ?? 0)
    cur.esims += 1
    agg.set(key, cur)
  }

  // Emit a continuous run of buckets from the first bucket covering `start`.
  const points: RevenuePoint[] = []
  const cursor =
    period === 'week'
      ? startOfWeek(start)
      : period === 'month'
        ? new Date(start.getFullYear(), start.getMonth(), 1)
        : new Date(start)
  for (let i = 0; cursor.getTime() <= end.getTime() && i < MAX_BUCKETS; i++) {
    const key = bucketKey(cursor, period)
    const v = agg.get(key) ?? { revenue: 0, esims: 0 }
    points.push({ date: key, revenue: v.revenue, esimsSold: v.esims })
    stepBucket(cursor, period)
  }
  return points
}

/* ---- recent activity feed (built from real tables) ---- */
export interface ActivityItem {
  id: string
  type: 'credit_allocation' | 'new_child' | 'large_sale' | 'refund' | 'ticket_escalation'
  description: string
  distributorName?: string
  amount?: number
  timestamp: string
}

export async function getActivityFeed(limit = 12): Promise<ActivityItem[]> {
  const supabase = createClient()

  const { data: dists } = await supabase.from('distributors').select('id, name, created_at')
  const nameById = new Map((dists ?? []).map((d) => [d.id, d.name as string]))

  const items: ActivityItem[] = []

  // New distributor signups
  for (const d of dists ?? []) {
    items.push({
      id: 'd-' + d.id,
      type: 'new_child',
      description: 'New distributor onboarded',
      distributorName: d.name,
      timestamp: d.created_at,
    })
  }

  // Recent sales (orders)
  const { data: orders } = await supabase
    .from('orders')
    .select('id, distributor_id, package_title, total, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  for (const o of orders ?? []) {
    items.push({
      id: 'o-' + o.id,
      type: 'large_sale',
      description: `eSIM issued — ${o.package_title ?? 'package'}`,
      distributorName: nameById.get(o.distributor_id),
      amount: Number(o.total ?? 0),
      timestamp: o.created_at,
    })
  }

  // Recent credit allocations
  const { data: wallets } = await supabase.from('wallets').select('id, distributor_id')
  const distByWallet = new Map((wallets ?? []).map((w) => [w.id, w.distributor_id]))
  const { data: allocs } = await supabase
    .from('wallet_transactions')
    .select('id, wallet_id, amount, created_at')
    .eq('type', 'allocation')
    .order('created_at', { ascending: false })
    .limit(limit)
  for (const a of allocs ?? []) {
    const distId = distByWallet.get(a.wallet_id)
    items.push({
      id: 'a-' + a.id,
      type: 'credit_allocation',
      description: 'Credit allocated',
      distributorName: distId ? nameById.get(distId) : undefined,
      amount: Number(a.amount ?? 0),
      timestamp: a.created_at,
    })
  }

  return items.sort((x, y) => (x.timestamp < y.timestamp ? 1 : -1)).slice(0, limit)
}
