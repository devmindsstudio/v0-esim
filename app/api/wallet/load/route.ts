import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/wallet/load
 * Admin-only. Records an eTijwaal credit purchase and adds it to the Ibara
 * "inventory" credit pool. Admin allocations to distributors draw down from
 * this pool, so it must be topped up here first.
 *
 * The actual eTijwaal purchase happens OUTSIDE the system (bank transfer) — this
 * route just records the result so the pool balance and margin are tracked.
 *
 * Body: { credit: number, cashPaid?: number, note?: string }
 *   • credit   = credit value received from eTijwaal (what enters the pool)
 *   • cashPaid = what Ibara actually paid (optional; kept for the margin record)
 */
export async function POST(request: Request) {
  const admin = createAdminClient()

  // --- 1. Authenticate the caller ---
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // --- 2. Only admins may load the pool ---
  const { data: adminRow } = await admin
    .from('admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!adminRow) {
    return NextResponse.json(
      { error: 'Only admins can load credit into the pool.' },
      { status: 403 },
    )
  }

  // --- 3. Validate the input ---
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { credit, cashPaid, note } = body
  if (typeof credit !== 'number' || !Number.isFinite(credit) || credit <= 0) {
    return NextResponse.json(
      { error: 'Enter a credit amount greater than 0.' },
      { status: 400 },
    )
  }
  const MAX_LOAD = 100_000_000
  if (credit > MAX_LOAD) {
    return NextResponse.json(
      { error: 'Credit exceeds the maximum allowed.' },
      { status: 400 },
    )
  }
  const cash =
    typeof cashPaid === 'number' && Number.isFinite(cashPaid) && cashPaid > 0 ? cashPaid : null

  // --- 4. Add to the pool (atomic, inside the DB function) ---
  const { data: newBalance, error } = await admin.rpc('admin_load_credit', {
    p_cash_paid: cash,
    p_credit: credit,
    p_note: note ?? null,
    p_actor_user_id: user.id,
    p_actor_role: 'admin',
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ poolBalance: Number(newBalance) }, { status: 200 })
}
