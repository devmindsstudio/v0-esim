'use client'

import { createClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'distributor' | 'sub_distributor'

export interface CurrentUser {
  authUserId: string
  email: string
  role: UserRole
  profileId: string // the id in the admins or distributors table
  name: string
  /** Account status. Admins are always 'active'; distributors/subs may be
   *  'active' | 'pending' | 'suspended' | 'dormant'. Only 'active' accounts may
   *  use the portal — see portalAccessError(). */
  status: string
}

/**
 * Gate for portal access: only 'active' accounts may log in / stay logged in.
 * Returns a message explaining why an account is blocked (pending, suspended or
 * dormant), or null when access is allowed. Admins are always 'active', so this
 * only ever gates distributors and sub-distributors.
 */
export function portalAccessError(status?: string | null): string | null {
  switch (status) {
    case 'pending':
      return 'Your account is pending approval. Please contact your administrator to activate it.'
    case 'suspended':
      return 'Your account has been suspended. Please contact your administrator.'
    case 'dormant':
      return 'Your account is inactive. Please contact your administrator.'
    default:
      return null
  }
}

/**
 * Works out WHO is logged in and WHAT role they have.
 *
 * 1. Ask Supabase Auth for the current user (this validates the login session).
 * 2. Look them up in `admins` by auth_user_id  -> they're an admin.
 * 3. Otherwise look them up in `distributors`  -> read their `role` (main or sub).
 *
 * Returns null if nobody is logged in, or the login has no linked profile.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Admin?
  const { data: admin } = await supabase
    .from('admins')
    .select('id, full_name, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (admin) {
    return {
      authUserId: user.id,
      email: admin.email,
      role: 'admin',
      profileId: admin.id,
      name: admin.full_name ?? 'Admin',
      status: 'active',
    }
  }

  // Distributor (main or sub)?
  const { data: dist } = await supabase
    .from('distributors')
    .select('id, name, email, role, status')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (dist) {
    return {
      authUserId: user.id,
      email: dist.email,
      role: (dist.role as UserRole) ?? 'distributor',
      profileId: dist.id,
      name: dist.name,
      status: dist.status ?? 'active',
    }
  }

  return null
}

/** Where each role should land after logging in. */
export function dashboardPathForRole(role: UserRole): string {
  return role === 'admin' ? '/dashboard' : '/distributor/dashboard'
}

/** Signs the current user out of Supabase. */
export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}

export interface CurrentDistributor {
  id: string
  tenantId: string
  name: string
  company: string
  email: string
  country: string
  countryCode: string
  walletBalance: number
  role: 'distributor' | 'sub_distributor'
  /** Pre-fills the commission % when this distributor tops up a sub. */
  defaultCommissionPercent: number
}

/**
 * Fetches the logged-in distributor's real profile + current wallet balance
 * from Supabase. Returns null if the logged-in user isn't a distributor.
 */
export async function getCurrentDistributor(): Promise<CurrentDistributor | null> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: dist } = await supabase
    .from('distributors')
    .select('id, tenant_id, name, company, email, country, country_code, role, default_commission_percent')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!dist) return null

  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', dist.id)
    .maybeSingle()

  return {
    id: dist.id,
    tenantId: dist.tenant_id,
    name: dist.name,
    company: dist.company ?? '',
    email: dist.email,
    country: dist.country ?? '',
    countryCode: dist.country_code ?? '',
    walletBalance: Number(wallet?.balance ?? 0),
    role: (dist.role as 'distributor' | 'sub_distributor') ?? 'distributor',
    defaultCommissionPercent: Number(dist.default_commission_percent ?? 0),
  }
}
