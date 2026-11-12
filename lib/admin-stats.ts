'use client'

import { createClient } from '@/lib/supabase/client'
import { getCreditCirculation } from '@/lib/wallet'
import { withinRange, type DashboardRange } from '@/lib/dashboard-range'

export interface AdminDashboardStats {
  totalDistributors: number
  activeDistributors: number
  pendingDistributors: number
  suspendedDistributors: number
  esimsSold: number
  grossRevenue: number
  totalCustomers: number
  creditInCirculation: number
  distributorsHolding: number
}

/**
 * Real network-wide KPIs for the admin dashboard.
 *
 * When `range` is set, the PERIOD metrics are limited to that window by
 * created_at: distributors onboarded, eSIMs sold, gross revenue, and customers
 * acquired. Credit in circulation is the ONE exception — it is a live snapshot
 * of unspent wallet balances right now, and we keep no historical balance
 * snapshots, so it can't be computed "as of" a past date. It always reflects the
 * present (the UI labels it accordingly when a filter is active).
 */
export async function getAdminDashboardStats(
  range?: DashboardRange,
): Promise<AdminDashboardStats> {
  const supabase = createClient()

  // Distributors onboarded in the period (all-time when no range is set), with
  // the status breakdown of that same set.
  const { data: dists } = await supabase
    .from('distributors')
    .select('status, created_at')
    .eq('role', 'distributor')
  const rows = (dists ?? []).filter((d) => withinRange(d.created_at, range))
  const totalDistributors = rows.length
  const activeDistributors = rows.filter((d) => d.status === 'active').length
  const pendingDistributors = rows.filter((d) => d.status === 'pending').length
  const suspendedDistributors = rows.filter((d) => d.status === 'suspended').length

  // Orders across the whole network (each order issues one eSIM in demo),
  // limited to the selected period.
  const { data: orders } = await supabase.from('orders').select('total, created_at')
  const periodOrders = (orders ?? []).filter((o) => withinRange(o.created_at, range))
  const esimsSold = periodOrders.length
  const grossRevenue = periodOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)

  // Customers acquired in the period (all-time when no range is set)
  const { data: custs } = await supabase.from('customers').select('created_at')
  const totalCustomers = (custs ?? []).filter((c) => withinRange(c.created_at, range)).length

  // Credit currently held (unspent) across the network (current-state)
  const circ = await getCreditCirculation()

  return {
    totalDistributors,
    activeDistributors,
    pendingDistributors,
    suspendedDistributors,
    esimsSold,
    grossRevenue,
    totalCustomers,
    creditInCirculation: circ.inCirculation,
    distributorsHolding: circ.distributorsHolding,
  }
}
