'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Customers live in the Supabase `customers` table, scoped by `distributor_id`
 * so each distributor (and sub-distributor) only ever sees their own.
 *
 * A customer's order/eSIM history now comes from the real `orders` table
 * (see lib/orders.ts) — there is no local mock anymore.
 */
export interface DistributorCustomer {
  id: string
  name: string
  email: string
  phone: string
  country: string
  createdAt: string
}

/** All customers belonging to ONE distributor. */
export async function getCustomers(distributorId: string): Promise<DistributorCustomer[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, phone, country, created_at')
    .eq('distributor_id', distributorId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email ?? '',
    phone: r.phone ?? '',
    country: r.country ?? '',
    createdAt: r.created_at,
  }))
}

/** Adds a customer for the given distributor. Returns null on failure. */
export async function addCustomer(
  distributorId: string,
  tenantId: string,
  input: { name: string; email: string; phone: string; country: string },
): Promise<DistributorCustomer | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('customers')
    .insert({
      distributor_id: distributorId,
      tenant_id: tenantId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      country: input.country,
    })
    .select('id, name, email, phone, country, created_at')
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    email: data.email ?? '',
    phone: data.phone ?? '',
    country: data.country ?? '',
    createdAt: data.created_at,
  }
}
