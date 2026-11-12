import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/wallet/allocate
 * Allocates wallet credit. Works for BOTH flows, decided by who is calling:
 *
 *   • ADMIN  → adds credit to a MAIN distributor's wallet
 *              (calls admin_allocate_credit — a single 'allocation' ledger row)
 *
 *   • MAIN DISTRIBUTOR → transfers credit from their own wallet to one of
 *              THEIR sub-distributors
 *              (calls distributor_allocate_credit — a 'debit' on the sender +
 *               an 'allocation' on the sub, done atomically in one transaction)
 *
 * All balance math + ledger writes happen inside the Postgres functions so
 * they are atomic. This route only authenticates the caller and checks that
 * they are allowed to allocate to the chosen recipient.
 *
 * Body: { toDistributorId: string, amount: number, note?: string }
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

  // --- 2. Validate the input ---
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { toDistributorId, note } = body
  // This is the CASH the recipient paid. The server turns it into credit =
  // cash × (1 + commission%). Accept `cashPaid` (current) and fall back to the
  // older `amount` key so nothing breaks mid-migration.
  const cashPaid =
    typeof body.cashPaid === 'number' ? body.cashPaid
    : typeof body.amount === 'number' ? body.amount
    : NaN
  // Require a real JSON number — don't coerce booleans/strings/arrays into money.
  if (typeof toDistributorId !== 'string' || !Number.isFinite(cashPaid) || cashPaid <= 0) {
    return NextResponse.json(
      { error: 'Enter a valid amount greater than 0.' },
      { status: 400 },
    )
  }
  // Absolute ceiling as a sanity guard (per-allocation).
  const MAX_ALLOCATION = 10_000_000
  if (cashPaid > MAX_ALLOCATION) {
    return NextResponse.json(
      { error: 'Amount exceeds the maximum allowed per allocation.' },
      { status: 400 },
    )
  }
  const amt = cashPaid

  // Commission % chosen for THIS top-up (no stored rate). Defaults to 0.
  const commissionPercent = typeof body.commissionPercent === 'number' ? body.commissionPercent : 0
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
    return NextResponse.json(
      { error: 'Commission % must be between 0 and 100.' },
      { status: 400 },
    )
  }
  const pct = commissionPercent

  // --- 3a. ADMIN caller → allocate to a main distributor ---
  const { data: adminRow } = await admin
    .from('admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (adminRow) {
    const { data: target } = await admin
      .from('distributors')
      .select('id, role, status')
      .eq('id', toDistributorId)
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 })
    }
    // Admin funds MAIN distributors only — subs are funded by their parent.
    if (target.role !== 'distributor') {
      return NextResponse.json(
        { error: 'Admins can only allocate credit to main distributors.' },
        { status: 400 },
      )
    }
    // A suspended distributor can't receive credit — reactivate them first.
    if (target.status === 'suspended') {
      return NextResponse.json(
        { error: 'This distributor is suspended. Reactivate them before topping up.' },
        { status: 400 },
      )
    }

    const { data: result, error } = await admin.rpc('admin_allocate_credit', {
      p_distributor_id: toDistributorId,
      p_cash_paid: amt,
      p_commission_percent: pct,
      p_note: note ?? null,
      p_actor_user_id: user.id,
      p_actor_role: 'admin',
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    // result = { credit, walletBalance, poolBalance, bonusPercent }.
    // `balance` is kept as an alias so any older caller still reads a number.
    const r = (result ?? {}) as Record<string, number>
    return NextResponse.json({ ...r, balance: Number(r.walletBalance ?? 0) }, { status: 200 })
  }

  // --- 3b. MAIN DISTRIBUTOR caller → transfer to their own sub-distributor ---
  const { data: caller } = await admin
    .from('distributors')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!caller || caller.role !== 'distributor') {
    return NextResponse.json(
      { error: 'Only admins or main distributors can allocate credit.' },
      { status: 403 },
    )
  }

  const { data: sub } = await admin
    .from('distributors')
    .select('id, parent_id, role, status')
    .eq('id', toDistributorId)
    .maybeSingle()
  if (!sub || sub.role !== 'sub_distributor' || sub.parent_id !== caller.id) {
    return NextResponse.json(
      { error: 'You can only allocate credit to your own sub-distributors.' },
      { status: 403 },
    )
  }
  // A suspended sub-distributor can't receive credit — reactivate them first.
  if (sub.status === 'suspended') {
    return NextResponse.json(
      { error: 'This sub-distributor is suspended. Reactivate them before topping up.' },
      { status: 400 },
    )
  }

  const { data: result, error } = await admin.rpc('distributor_allocate_credit', {
    p_from_distributor_id: caller.id,
    p_to_sub_id: toDistributorId,
    p_cash_paid: amt,
    p_commission_percent: pct,
    p_note: note ?? null,
    p_actor_user_id: user.id,
    p_actor_role: caller.role,
  })
  if (error) {
    // e.g. "Insufficient balance" — surfaced to the UI
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(result, { status: 200 })
}
