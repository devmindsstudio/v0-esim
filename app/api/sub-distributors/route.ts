import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/sub-distributors
 * Distributor-only. Creates a SUB-distributor UNDER the caller:
 *   1. verifies the caller is a MAIN distributor (role = 'distributor')
 *   2. creates a login (Supabase auth user)
 *   3. creates the sub-distributor row
 *        - SAME tenant as the parent (they live inside the parent's network)
 *        - parent_id = the caller's distributor id
 *        - role = 'sub_distributor'
 *   4. creates their wallet (starts at 0)
 * If any step fails, the earlier steps are rolled back so we never leave orphans.
 *
 * NOTE: unlike the admin route, this does NOT create a new tenant — a
 * sub-distributor belongs to the SAME network (tenant) as their parent.
 */
export async function POST(request: Request) {
  const admin = createAdminClient()

  // --- 1. Verify the caller is a logged-in MAIN distributor ---
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

  // Look the caller up in `distributors`. They must exist AND be a MAIN
  // distributor — a sub-distributor cannot create further sub-distributors.
  const { data: parent } = await admin
    .from('distributors')
    .select('id, tenant_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!parent || parent.role !== 'distributor') {
    return NextResponse.json(
      { error: 'Only main distributors can create sub-distributors.' },
      { status: 403 },
    )
  }

  // --- 2. Read + validate the form data ---
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { name, company, email, password, whatsapp, country, countryCode } = body
  if (!name || !company || !email || !password) {
    return NextResponse.json(
      { error: 'Name, company, email and password are required.' },
      { status: 400 },
    )
  }

  // --- 3. Create the sub-distributor's LOGIN (email pre-confirmed) ---
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !createdUser.user) {
    return NextResponse.json(
      { error: createErr?.message ?? 'Could not create the login.' },
      { status: 400 },
    )
  }
  const authUserId = createdUser.user.id

  // --- 4. Create the SUB-DISTRIBUTOR (same tenant, parent = caller) ---
  const { data: sub, error: subErr } = await admin
    .from('distributors')
    .insert({
      tenant_id: parent.tenant_id,
      parent_id: parent.id,
      auth_user_id: authUserId,
      role: 'sub_distributor',
      name,
      company,
      email,
      whatsapp: whatsapp ?? null,
      country: country ?? null,
      country_code: countryCode ?? null,
      status: 'active',
      created_by_admin_id: null, // created by a distributor, not an admin
    })
    .select('id, name, company, email, country, status, created_at')
    .single()
  if (subErr || !sub) {
    await admin.auth.admin.deleteUser(authUserId) // undo the login
    return NextResponse.json(
      { error: subErr?.message ?? 'Could not create the sub-distributor.' },
      { status: 400 },
    )
  }

  // --- 5. Create their WALLET (starts at 0) ---
  const { error: walletErr } = await admin
    .from('wallets')
    .insert({ tenant_id: parent.tenant_id, distributor_id: sub.id, balance: 0, currency: 'USD' })
  if (walletErr) {
    await admin.from('distributors').delete().eq('id', sub.id)
    await admin.auth.admin.deleteUser(authUserId)
    return NextResponse.json({ error: walletErr.message }, { status: 400 })
  }

  return NextResponse.json({ subDistributor: sub }, { status: 201 })
}
