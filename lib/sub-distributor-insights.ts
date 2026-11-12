'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Read-only performance + activity for the sub-distributors that sit UNDER a
 * given main distributor (parent_id = parentId, role = 'sub_distributor').
 *
 * A main distributor legitimately owns this data: the subs share their tenant
 * and were created by them. We resolve the sub ids first, then read orders /
 * customers scoped to those ids — the same app-level scoping the rest of the
 * portal uses. (When Phase-2 RLS lands on orders/customers, the policy must
 * allow a parent to read its subs' rows — mirroring the wallets policy.)
 */

export interface SubDistributorInsight {
  id: string
  name: string
  company: string
  status: string
  walletBalance: number
  esimsSold: number
  revenue: number
  customerCount: number
  lastSaleAt: string | null
  createdAt: string
}

export interface SubNetworkSummary {
  totalSubs: number
  activeSubs: number
  esimsSold: number
  revenue: number
  customerCount: number
  creditHeld: number
}

export interface SubActivityItem {
  id: string
  subName: string
  packageTitle: string
  total: number
  createdAt: string
}

/** Per-sub performance for one parent distributor. [] if it has no subs. */
export async function getSubDistributorInsights(
  parentId: string,
): Promise<SubDistributorInsight[]> {
  const supabase = createClient()

  // 1) My sub-distributors.
  const { data: subs } = await supabase
    .from('distributors')
    .select('id, name, company, status, created_at')
    .eq('parent_id', parentId)
    .eq('role', 'sub_distributor')
    .order('created_at', { ascending: false })
  const rows = subs ?? []
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)

  // 2) Wallet balances (credit each sub currently holds).
  const balById = new Map<string, number>()
  const { data: wallets } = await supabase
    .from('wallets')
    .select('distributor_id, balance')
    .in('distributor_id', ids)
  for (const w of wallets ?? []) balById.set(w.distributor_id, Number(w.balance ?? 0))

  // 3) Orders → eSIMs sold + revenue + last sale, per sub. (1 order = 1 eSIM.)
  const orderAgg = new Map<string, { esims: number; revenue: number; lastSale: string | null }>()
  const { data: orders } = await supabase
    .from('orders')
    .select('distributor_id, total, created_at')
    .in('distributor_id', ids)
  for (const o of orders ?? []) {
    const cur = orderAgg.get(o.distributor_id) ?? { esims: 0, revenue: 0, lastSale: null }
    cur.esims += 1
    cur.revenue += Number(o.total ?? 0)
    if (!cur.lastSale || o.created_at > cur.lastSale) cur.lastSale = o.created_at
    orderAgg.set(o.distributor_id, cur)
  }

  // 4) Customer counts, per sub.
  const custCount = new Map<string, number>()
  const { data: custs } = await supabase
    .from('customers')
    .select('distributor_id')
    .in('distributor_id', ids)
  for (const c of custs ?? [])
    custCount.set(c.distributor_id, (custCount.get(c.distributor_id) ?? 0) + 1)

  return rows.map((r) => {
    const a = orderAgg.get(r.id) ?? { esims: 0, revenue: 0, lastSale: null }
    return {
      id: r.id,
      name: r.name,
      company: r.company ?? '',
      status: r.status ?? 'active',
      walletBalance: balById.get(r.id) ?? 0,
      esimsSold: a.esims,
      revenue: a.revenue,
      customerCount: custCount.get(r.id) ?? 0,
      lastSaleAt: a.lastSale,
      createdAt: r.created_at,
    }
  })
}

/** Roll the per-sub rows up into one network total. */
export function summarizeSubNetwork(insights: SubDistributorInsight[]): SubNetworkSummary {
  return insights.reduce<SubNetworkSummary>(
    (s, d) => ({
      totalSubs: s.totalSubs + 1,
      activeSubs: s.activeSubs + (d.status === 'active' ? 1 : 0),
      esimsSold: s.esimsSold + d.esimsSold,
      revenue: s.revenue + d.revenue,
      customerCount: s.customerCount + d.customerCount,
      creditHeld: s.creditHeld + d.walletBalance,
    }),
    { totalSubs: 0, activeSubs: 0, esimsSold: 0, revenue: 0, customerCount: 0, creditHeld: 0 },
  )
}

/** Recent eSIM sales across ALL of a parent's sub-distributors, newest first. */
export async function getSubNetworkActivity(
  parentId: string,
  limit = 8,
): Promise<SubActivityItem[]> {
  const supabase = createClient()

  const { data: subs } = await supabase
    .from('distributors')
    .select('id, name')
    .eq('parent_id', parentId)
    .eq('role', 'sub_distributor')
  const rows = subs ?? []
  if (rows.length === 0) return []

  const nameById = new Map(rows.map((r) => [r.id, r.name as string]))
  const ids = rows.map((r) => r.id)

  const { data: orders } = await supabase
    .from('orders')
    .select('id, distributor_id, package_title, total, created_at')
    .in('distributor_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (orders ?? []).map((o) => ({
    id: o.id,
    subName: nameById.get(o.distributor_id) ?? '—',
    packageTitle: o.package_title ?? 'package',
    total: Number(o.total ?? 0),
    createdAt: o.created_at,
  }))
}
