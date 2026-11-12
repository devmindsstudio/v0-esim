import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/distributors
 * Admin-only. Creates a new MAIN distributor:
 *   1. verifies the caller is an admin
 *   2. creates a login (Supabase auth user)
 *   3. creates the tenant (their network)
 *   4. creates the distributor row
 *   5. creates their wallet
 * If any step fails, the earlier steps are rolled back so we never leave orphans.
 */
export async function POST(request: Request) {
  const admin = createAdminClient()

  // --- 1. Verify the caller is a logged-in ADMIN ---
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

  const { data: adminRow } = await admin
    .from('admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!adminRow) {
    return NextResponse.json({ error: 'Only admins can create distributors.' }, { status: 403 })
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

  // --- 3. Create the distributor's LOGIN (email pre-confirmed so they can sign in) ---
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

  // --- 4. Create the TENANT (this distributor's own network) ---
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({ name: company, created_by_admin_id: adminRow.id })
    .select('id')
    .single()
  if (tenantErr || !tenant) {
    await admin.auth.admin.deleteUser(authUserId) // undo the login
    return NextResponse.json(
      { error: tenantErr?.message ?? 'Could not create the tenant.' },
      { status: 400 },
    )
  }

  // --- 5. Create the DISTRIBUTOR (a MAIN: parent_id stays null, role = distributor) ---
  const { data: distributor, error: distErr } = await admin
    .from('distributors')
    .insert({
      tenant_id: tenant.id,
      parent_id: null,
      auth_user_id: authUserId,
      role: 'distributor',
      name,
      company,
      email,
      whatsapp: whatsapp ?? null,
      country: country ?? null,
      country_code: countryCode ?? null,
      status: 'active',
      created_by_admin_id: adminRow.id,
    })
    .select('id, name, company, email, country, status, created_at')
    .single()
  if (distErr || !distributor) {
    await admin.from('tenants').delete().eq('id', tenant.id)
    await admin.auth.admin.deleteUser(authUserId)
    return NextResponse.json(
      { error: distErr?.message ?? 'Could not create the distributor.' },
      { status: 400 },
    )
  }

  // --- 6. Create their WALLET (starts at 0) ---
  const { error: walletErr } = await admin
    .from('wallets')
    .insert({ tenant_id: tenant.id, distributor_id: distributor.id, balance: 0, currency: 'USD' })
  if (walletErr) {
    await admin.from('distributors').delete().eq('id', distributor.id)
    await admin.from('tenants').delete().eq('id', tenant.id)
    await admin.auth.admin.deleteUser(authUserId)
    return NextResponse.json({ error: walletErr.message }, { status: 400 })
  }

  return NextResponse.json({ distributor }, { status: 201 })
}
