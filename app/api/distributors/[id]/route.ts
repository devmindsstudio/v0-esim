import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/distributors/:id
 * Permanently removes a distributor (or sub-distributor) and their login.
 *
 *   • ADMIN caller       → may delete a MAIN distributor
 *   • MAIN DISTRIBUTOR   → may delete one of THEIR OWN sub-distributors
 *
 * Guards against orphaning a network: a distributor that still has
 * sub-distributors can't be deleted until those are removed first. Financial
 * history (ledger / orders) is left intact as an audit trail — only the
 * distributor row, their wallet and their login are removed.
 */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = createAdminClient()
  const { id } = await ctx.params

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

  // --- 2. Load the target ---
  const { data: target } = await admin
    .from('distributors')
    .select('id, role, parent_id, auth_user_id, name')
    .eq('id', id)
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 })
  }

  // --- 3. Authorize: admin → main distributor; distributor → own sub ---
  const { data: adminRow } = await admin
    .from('admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  let authorized = false
  if (adminRow) {
    if (target.role !== 'distributor') {
      return NextResponse.json(
        { error: 'Admins can only delete main distributors.' },
        { status: 400 },
      )
    }
    authorized = true
  } else {
    const { data: caller } = await admin
      .from('distributors')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (
      caller &&
      caller.role === 'distributor' &&
      target.role === 'sub_distributor' &&
      target.parent_id === caller.id
    ) {
      authorized = true
    }
  }
  if (!authorized) {
    return NextResponse.json(
      { error: 'You are not allowed to delete this account.' },
      { status: 403 },
    )
  }

  // --- 4. Guard: don't orphan a sub-network ---
  const { count } = await admin
    .from('distributors')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', id)
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'This distributor still has sub-distributors. Delete or reassign them first, then try again.',
      },
      { status: 400 },
    )
  }

  // --- 5. Delete the distributor row (then best-effort cleanup) ---
  const { error: delErr } = await admin.from('distributors').delete().eq('id', id)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 })
  }
  // Wallet and login are dependents — remove them too. Best-effort: the account
  // is already gone from the network, so a stray wallet/login can't be used.
  await admin.from('wallets').delete().eq('distributor_id', id)
  if (target.auth_user_id) {
    await admin.auth.admin.deleteUser(target.auth_user_id)
  }

  return NextResponse.json({ ok: true, id, name: target.name }, { status: 200 })
}
