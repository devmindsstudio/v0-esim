'use client'

import { createClient } from '@/lib/supabase/client'

export interface DistributorOrder {
  id: string
  customerId: string | null
  packageTitle: string
  currency: string
  total: number
  status: string
  createdAt: string
  customerName: string
  esimNumber: string | null
  esimStatus: string | null
}

/** All orders placed by one distributor, newest first, with customer + eSIM info. */
export async function getDistributorOrders(distributorId: string): Promise<DistributorOrder[]> {
  const supabase = createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, package_title, currency, total, status, created_at, customer_id')
    .eq('distributor_id', distributorId)
    .order('created_at', { ascending: false })
  if (!orders || orders.length === 0) return []

  // Customer names
  const custIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))]
  const { data: custs } = custIds.length
    ? await supabase.from('customers').select('id, name').in('id', custIds)
    : { data: [] }
  const nameById = new Map((custs ?? []).map((c) => [c.id, c.name]))

  // eSIM per order
  const orderIds = orders.map((o) => o.id)
  const { data: esims } = await supabase
    .from('esims')
    .select('order_id, esim_number, status')
    .in('order_id', orderIds)
  const esimByOrder = new Map((esims ?? []).map((e) => [e.order_id, e]))

  return orders.map((o) => {
    const e = esimByOrder.get(o.id)
    return {
      id: o.id,
      customerId: o.customer_id ?? null,
      packageTitle: o.package_title ?? '',
      currency: o.currency ?? 'USD',
      total: Number(o.total ?? 0),
      status: o.status,
      createdAt: o.created_at,
      customerName: (o.customer_id && nameById.get(o.customer_id)) || '—',
      esimNumber: e?.esim_number ?? null,
      esimStatus: e?.status ?? null,
    }
  })
}
