import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/settings/default-commission  { defaultCommissionPercent }
 * Saves the default commission % used to PRE-FILL top-ups. Role-aware:
 *   • ADMIN       → the global default (app_settings), used for admin→distributor top-ups
 *   • DISTRIBUTOR → their own default (distributors row), used for their sub top-ups
 * Writes run with service_role, so no table write policies are needed.
 */
export async function POST(request: Request) {
  const admin = createAdminClient()

  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token)
  if (userError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const pct = Number(body?.defaultCommissionPercent)
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ error: 'Commission % must be between 0 and 100.' }, { status: 400 })
  }

  // Admin → global default.
  const { data: adminRow } = await admin
    .from('admins')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (adminRow) {
    const { error } = await admin
      .from('app_settings')
      .update({ default_commission_percent: pct, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, scope: 'global', defaultCommissionPercent: pct })
  }

  // Main distributor → their own default (used for topping up their sub-distributors).
  const { data: caller } = await admin
    .from('distributors')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (caller && caller.role === 'distributor') {
    const { error } = await admin
      .from('distributors')
      .update({ default_commission_percent: pct })
      .eq('id', caller.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, scope: 'self', defaultCommissionPercent: pct })
  }

  return NextResponse.json({ error: 'Not allowed to set a default commission.' }, { status: 403 })
}
