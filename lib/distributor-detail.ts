'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Admin distributor detail: profile + every purchase across the distributor AND
 * the sub-distributors beneath them (parent_id = id, role = 'sub_distributor').
 *
 * Reads orders / customers / esims client-side, the same access the admin
 * dashboard and sub-distributor insights already use. (When Phase-2 RLS lands on
 * orders/esims, the read policy must let an admin — and a parent — see these
 * rows, mirroring the wallets policy.)
 */

export interface DistributorProfile {
  id: string
  name: string
  company: string
  email: string
  whatsapp: string
  country: string
  status: string
  role: string
  walletBalance: number
  createdAt: string
}

export interface NetworkPurchase {
  id: string
  packageTitle: string
  currency: string
  /** What the eSIM cost the distributor (credit spent). */
  total: number
  status: string
  createdAt: string
  customerName: string
  esimNumber: string | null
  /** Who placed it — the distributor themselves or one of their subs. */
  placedByName: string
  isSub: boolean
  /** Price charged to the end customer (null until recorded). */
  salePrice: number | null
  /** Real profit on this sale = salePrice − total (null when no sale price). */
  margin: number | null
}

/** One credit top-up this distributor RECEIVED (from Ibara, or their parent). */
export interface TopUp {
  id: string
  createdAt: string
  /** Cash they paid for this top-up (null on legacy rows without it). */
  cashPaid: number | null
  /** Credit they received = cash × (1 + bonus%). */
  creditReceived: number
  /** Bonus % applied to this top-up. */
  bonusPercent: number | null
  /** The extra credit granted beyond the cash — the "profit" for this top-up. */
  additional: number
  note: string
}

export interface DistributorDetail {
  profile: DistributorProfile | null
  /** Number of sub-distributors beneath this distributor. */
  subCount: number
  purchases: NetworkPurchase[]
  /** Every top-up this distributor received, newest first. */
  topUps: TopUp[]
  /** VIRTUAL profit: total bonus credit given to them across all top-ups. */
  totalProfit: number
  /** REAL profit: Σ(sale price − cost) over sales that have a recorded price. */
  realProfit: number
}

export async function getDistributorDetail(id: string): Promise<DistributorDetail> {
  const supabase = createClient()

  // Profile
  const { data: d } = await supabase
    .from('distributors')
    .select('id, name, company, email, whatsapp, country, status, role, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!d) return { profile: null, subCount: 0, purchases: [], topUps: [], totalProfit: 0, realProfit: 0 }

  // Current wallet balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', id)
    .maybeSingle()

  const profile: DistributorProfile = {
    id: d.id,
    name: d.name,
    company: d.company ?? '',
    email: d.email ?? '',
    whatsapp: d.whatsapp ?? '',
    country: d.country ?? '',
    status: d.status ?? 'active',
    role: d.role ?? 'distributor',
    walletBalance: Number(wallet?.balance ?? 0),
    createdAt: d.created_at,
  }

  // Sub-distributors beneath this distributor
  const { data: subs } = await supabase
    .from('distributors')
    .select('id, name')
    .eq('parent_id', id)
    .eq('role', 'sub_distributor')
  const subRows = subs ?? []
  const subIds = new Set(subRows.map((s) => s.id))

  // Name lookup for the "placed by" column (root + each sub).
  const nameById = new Map<string, string>([[id, d.name]])
  for (const s of subRows) nameById.set(s.id, s.name)

  const allIds = [id, ...subRows.map((s) => s.id)]

  // Every order across the network, newest first.
  // Prefer selecting sale_price; if the column isn't there yet (step12 migration
  // not run), fall back to the base columns so purchases still load.
  type OrderRow = {
    id: string
    package_title: string | null
    currency: string | null
    total: number | null
    sale_price?: number | null
    status: string
    created_at: string
    customer_id: string | null
    distributor_id: string
  }
  const saleCols =
    'id, package_title, currency, total, sale_price, status, created_at, customer_id, distributor_id'
  const baseCols = 'id, package_title, currency, total, status, created_at, customer_id, distributor_id'
  const withSale = await supabase
    .from('orders')
    .select(saleCols)
    .in('distributor_id', allIds)
    .order('created_at', { ascending: false })
  const orderRows: OrderRow[] = withSale.error
    ? (((
        await supabase
          .from('orders')
          .select(baseCols)
          .in('distributor_id', allIds)
          .order('created_at', { ascending: false })
      ).data ?? []) as unknown as OrderRow[])
    : ((withSale.data ?? []) as unknown as OrderRow[])

  // Customer names for those orders.
  const custIds = [...new Set(orderRows.map((o) => o.customer_id).filter(Boolean))]
  const { data: custs } = custIds.length
    ? await supabase.from('customers').select('id, name').in('id', custIds)
    : { data: [] }
  const custName = new Map((custs ?? []).map((c) => [c.id, c.name]))

  // eSIM per order.
  const orderIds = orderRows.map((o) => o.id)
  const { data: esims } = orderIds.length
    ? await supabase.from('esims').select('order_id, esim_number, status').in('order_id', orderIds)
    : { data: [] }
  const esimByOrder = new Map((esims ?? []).map((e) => [e.order_id, e]))

  const purchases: NetworkPurchase[] = orderRows.map((o) => {
    const e = esimByOrder.get(o.id)
    const total = Number(o.total ?? 0)
    const salePrice = o.sale_price == null ? null : Number(o.sale_price)
    return {
      id: o.id,
      packageTitle: o.package_title ?? '',
      currency: o.currency ?? 'USD',
      total,
      status: o.status,
      createdAt: o.created_at,
      customerName: (o.customer_id && custName.get(o.customer_id)) || '—',
      esimNumber: e?.esim_number ?? null,
      placedByName: nameById.get(o.distributor_id) ?? '—',
      isSub: subIds.has(o.distributor_id),
      salePrice,
      margin: salePrice == null ? null : salePrice - total,
    }
  })
  // REAL profit = the recorded margins summed (sales without a price don't count).
  const realProfit = purchases.reduce((s, p) => s + (p.margin ?? 0), 0)

  // Top-ups this distributor RECEIVED (from Ibara or their parent). The bonus
  // credit beyond the cash paid (commission_amount) is the "profit" per top-up.
  const { data: topupRows } = await supabase
    .from('ledger')
    .select('id, cash_paid, credit_amount, commission_percent, commission_amount, note, created_at')
    .eq('to_distributor_id', id)
    .in('entry_type', ['topup_admin', 'topup_sub'])
    .order('created_at', { ascending: false })

  const topUps: TopUp[] = (topupRows ?? []).map((r) => {
    const cashPaid = r.cash_paid == null ? null : Number(r.cash_paid)
    const creditReceived = Number(r.credit_amount ?? 0)
    // Prefer the stored bonus; fall back to credit − cash for older rows.
    const additional =
      r.commission_amount != null
        ? Number(r.commission_amount)
        : cashPaid == null
          ? 0
          : creditReceived - cashPaid
    return {
      id: r.id,
      createdAt: r.created_at,
      cashPaid,
      creditReceived,
      bonusPercent: r.commission_percent == null ? null : Number(r.commission_percent),
      additional,
      note: r.note ?? '',
    }
  })
  const totalProfit = topUps.reduce((s, t) => s + t.additional, 0)

  return { profile, subCount: subRows.length, purchases, topUps, totalProfit, realProfit }
}

/**
 * Same detail, but scoped for a main distributor viewing ONE of their own
 * sub-distributors. Confirms `subId` really is a sub-distributor beneath
 * `parentId` before returning anything, so a distributor can't view an account
 * that isn't in their network. Returns an empty (not-found) detail otherwise.
 */
export async function getSubDistributorDetail(
  parentId: string,
  subId: string,
): Promise<DistributorDetail> {
  const supabase = createClient()
  const { data: owned } = await supabase
    .from('distributors')
    .select('id')
    .eq('id', subId)
    .eq('parent_id', parentId)
    .eq('role', 'sub_distributor')
    .maybeSingle()

  if (!owned) {
    return { profile: null, subCount: 0, purchases: [], topUps: [], totalProfit: 0, realProfit: 0 }
  }
  return getDistributorDetail(subId)
}
