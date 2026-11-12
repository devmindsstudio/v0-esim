'use client'

import { createClient } from '@/lib/supabase/client'

export type WalletTxType = 'allocation' | 'debit' | 'refund' | 'topup'

export interface WalletTx {
  id: string
  type: WalletTxType
  amount: number
  balanceAfter: number
  note: string
  createdAt: string
}

/** Incoming = money added to this wallet; debit = money leaving it. */
export function isCredit(type: WalletTxType): boolean {
  return type !== 'debit'
}

/**
 * Reads the ledger for a given distributor's wallet, newest first.
 * Returns [] if the distributor has no wallet yet.
 */
export async function getWalletTransactions(distributorId: string): Promise<WalletTx[]> {
  const supabase = createClient()

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('distributor_id', distributorId)
    .maybeSingle()
  if (!wallet) return []

  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('id, type, amount, balance_after, note, created_at')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    type: r.type as WalletTxType,
    amount: Number(r.amount),
    balanceAfter: Number(r.balance_after),
    note: r.note ?? '',
    createdAt: r.created_at,
  }))
}

/* ---------------------------------------------------------------------------
 * Credit in circulation.
 *
 * This is separate from the inventory pool (see getCreditPool): the pool is
 * credit Ibara has loaded but NOT yet allocated, whereas "in circulation" is
 * credit already handed out and still sitting unspent in distributor wallets.
 *   • inCirculation       = sum of ALL wallet balances = unspent credit currently
 *                           held across the whole distributor network
 *   • distributorsHolding = how many distributors currently hold more than $0
 * ------------------------------------------------------------------------- */
export interface CreditCirculation {
  inCirculation: number
  distributorsHolding: number
}

export async function getCreditCirculation(): Promise<CreditCirculation> {
  const supabase = createClient()
  const { data: wallets } = await supabase.from('wallets').select('balance')
  const rows = wallets ?? []
  const inCirculation = rows.reduce((s, w) => s + Number(w.balance ?? 0), 0)
  const distributorsHolding = rows.filter((w) => Number(w.balance ?? 0) > 0).length
  return { inCirculation, distributorsHolding }
}

export interface AdminCreditTx {
  id: string
  distributorName: string
  company: string
  type: WalletTxType
  amount: number
  note: string
  createdAt: string
}

/** Recent ledger rows across the whole network, with the wallet's owner name. */
export async function getAdminCreditTransactions(limit = 15): Promise<AdminCreditTx[]> {
  const supabase = createClient()

  const { data: txs } = await supabase
    .from('wallet_transactions')
    .select('id, wallet_id, type, amount, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!txs || txs.length === 0) return []

  const walletIds = [...new Set(txs.map((t) => t.wallet_id))]
  const { data: ws } = await supabase
    .from('wallets')
    .select('id, distributor_id')
    .in('id', walletIds)

  const distIds = [...new Set((ws ?? []).map((w) => w.distributor_id))]
  const { data: ds } = distIds.length
    ? await supabase.from('distributors').select('id, name, company').in('id', distIds)
    : { data: [] }

  const distById = new Map((ds ?? []).map((d) => [d.id, { name: d.name, company: d.company ?? '' }]))
  const infoByWallet = new Map(
    (ws ?? []).map((w) => [w.id, distById.get(w.distributor_id) ?? { name: 'Unknown', company: '' }]),
  )

  return txs.map((t) => {
    const info = infoByWallet.get(t.wallet_id) ?? { name: 'Unknown', company: '' }
    return {
      id: t.id,
      distributorName: info.name,
      company: info.company,
      type: t.type as WalletTxType,
      amount: Number(t.amount),
      note: t.note ?? '',
      createdAt: t.created_at,
    }
  })
}

export interface AllocatableDistributor {
  id: string
  name: string
  company: string
  walletBalance: number
}

/** Main distributors the admin can allocate to, with their current balance. */
export async function getAllocatableDistributors(): Promise<AllocatableDistributor[]> {
  const supabase = createClient()

  const { data: mains } = await supabase
    .from('distributors')
    .select('id, name, company')
    .eq('role', 'distributor')
    .order('name', { ascending: true })
  const rows = mains ?? []

  const ids = rows.map((r) => r.id)
  const balByDist = new Map<string, number>()
  if (ids.length) {
    const { data: ws } = await supabase
      .from('wallets')
      .select('distributor_id, balance')
      .in('distributor_id', ids)
    for (const w of ws ?? []) balByDist.set(w.distributor_id, Number(w.balance ?? 0))
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    company: r.company ?? '',
    walletBalance: balByDist.get(r.id) ?? 0,
  }))
}

/* ---------------------------------------------------------------------------
 * Ibara credit pool ("inventory wallet").
 *
 * Ibara buys credit from eTijwaal outside the system and LOADS it into this
 * pool. Admin allocations to distributors draw down from it. `balance` is what
 * is left to allocate; `totalLoaded` is the lifetime amount ever loaded in.
 * ------------------------------------------------------------------------- */
export interface CreditPool {
  balance: number
  totalLoaded: number
}

export async function getCreditPool(): Promise<CreditPool> {
  const supabase = createClient()
  const { data } = await supabase
    .from('credit_pool')
    .select('balance, total_loaded')
    .eq('id', 1)
    .maybeSingle()
  return {
    balance: Number(data?.balance ?? 0),
    totalLoaded: Number(data?.total_loaded ?? 0),
  }
}

export interface CreditPoolTx {
  id: string
  type: 'load' | 'allocation'
  cashPaid: number | null
  creditAmount: number
  balanceAfter: number
  note: string
  createdAt: string
}

/** The pool ledger — every eTijwaal load and every allocation out, newest first. */
export async function getCreditPoolLedger(limit = 15): Promise<CreditPoolTx[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('credit_pool_ledger')
    .select('id, type, cash_paid, credit_amount, balance_after, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id,
    type: r.type as 'load' | 'allocation',
    cashPaid: r.cash_paid == null ? null : Number(r.cash_paid),
    creditAmount: Number(r.credit_amount),
    balanceAfter: Number(r.balance_after),
    note: r.note ?? '',
    createdAt: r.created_at,
  }))
}

/* ---------------------------------------------------------------------------
 * Unified transaction ledger (step9).
 *
 * The `ledger` table is the single "book of record" every money event writes
 * to: pool loads, admin/sub top-ups, and eSIM sales. RLS lets an admin read
 * everything; a distributor reads only rows that involve them.
 * ------------------------------------------------------------------------- */
export type LedgerType = 'pool_load' | 'topup_admin' | 'topup_sub' | 'sale'

export interface LedgerEntry {
  id: string
  entryType: LedgerType
  actorRole: string | null
  fromDistributorId: string | null // raw ids — used to work out money-in vs money-out
  toDistributorId: string | null
  fromName: string | null // resolved distributor name (payer / seller)
  toName: string | null // resolved distributor name (recipient)
  customerName: string | null // resolved customer name (for a sale)
  cashPaid: number | null
  creditAmount: number
  commissionPercent: number | null
  commissionAmount: number | null // the bonus $ on a top-up
  balanceAfter: number | null
  referenceOrderId: string | null
  providerOrderRef: string | null
  note: string
  createdAt: string
}

/**
 * Reads ledger rows newest-first and resolves the distributor/customer ids to
 * names so the table is readable. Relies on RLS for who sees which rows.
 */
export async function getLedger(limit = 100): Promise<LedgerEntry[]> {
  const supabase = createClient()

  const { data: rows } = await supabase
    .from('ledger')
    .select('id, entry_type, actor_role, from_distributor_id, to_distributor_id, customer_id, cash_paid, credit_amount, commission_percent, commission_amount, balance_after, reference_order_id, provider_order_ref, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!rows || rows.length === 0) return []

  // Resolve distributor + customer names in a single batch each.
  const distIds = [
    ...new Set(
      rows.flatMap((r) => [r.from_distributor_id, r.to_distributor_id]).filter(Boolean) as string[],
    ),
  ]
  const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[])]

  const { data: ds } = distIds.length
    ? await supabase.from('distributors').select('id, name').in('id', distIds)
    : { data: [] }
  const { data: cs } = custIds.length
    ? await supabase.from('customers').select('id, name').in('id', custIds)
    : { data: [] }

  const distName = new Map((ds ?? []).map((d) => [d.id, d.name as string]))
  const custName = new Map((cs ?? []).map((c) => [c.id, c.name as string]))

  return rows.map((r) => ({
    id: r.id,
    entryType: r.entry_type as LedgerType,
    actorRole: r.actor_role ?? null,
    fromDistributorId: r.from_distributor_id ?? null,
    toDistributorId: r.to_distributor_id ?? null,
    fromName: r.from_distributor_id ? distName.get(r.from_distributor_id) ?? '—' : null,
    toName: r.to_distributor_id ? distName.get(r.to_distributor_id) ?? '—' : null,
    customerName: r.customer_id ? custName.get(r.customer_id) ?? '—' : null,
    cashPaid: r.cash_paid == null ? null : Number(r.cash_paid),
    creditAmount: Number(r.credit_amount),
    commissionPercent: r.commission_percent == null ? null : Number(r.commission_percent),
    commissionAmount: r.commission_amount == null ? null : Number(r.commission_amount),
    balanceAfter: r.balance_after == null ? null : Number(r.balance_after),
    referenceOrderId: r.reference_order_id ?? null,
    providerOrderRef: r.provider_order_ref ?? null,
    note: r.note ?? '',
    createdAt: r.created_at,
  }))
}

export interface DistributorProfit {
  distributorId: string
  name: string
  role: string
  commissionReceived: number
  commissionGiven: number
  netProfit: number
  creditSoldAsEsims: number
}

/**
 * Profit per distributor (simple-spread model): commission received on its own
 * top-ups minus commission it gave to its subs. Reads the v_distributor_profit
 * view; only rows with any activity are returned.
 */
export async function getDistributorProfit(): Promise<DistributorProfit[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('v_distributor_profit')
    .select('distributor_id, distributor_name, role, commission_received, commission_given, net_profit, credit_sold_as_esims')
    .order('net_profit', { ascending: false })

  return (data ?? [])
    .map((r) => ({
      distributorId: r.distributor_id,
      name: r.distributor_name ?? '—',
      role: r.role ?? '',
      commissionReceived: Number(r.commission_received ?? 0),
      commissionGiven: Number(r.commission_given ?? 0),
      netProfit: Number(r.net_profit ?? 0),
      creditSoldAsEsims: Number(r.credit_sold_as_esims ?? 0),
    }))
    // Hide distributors with no ledger activity at all — keeps the table useful.
    .filter(
      (r) => r.commissionReceived !== 0 || r.commissionGiven !== 0 || r.creditSoldAsEsims !== 0,
    )
}
