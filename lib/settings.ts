'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * The admin's global default commission % — pre-fills admin → distributor
 * top-ups. Readable only by admins (RLS). Returns 0 if unset.
 */
export async function getGlobalDefaultCommission(): Promise<number> {
  const supabase = createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('default_commission_percent')
    .eq('id', 1)
    .maybeSingle()
  return Number(data?.default_commission_percent ?? 0)
}
