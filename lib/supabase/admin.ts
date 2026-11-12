import { createClient } from '@supabase/supabase-js'

/**
 * SERVER-ONLY Supabase client using the SERVICE ROLE key.
 *
 * The service role key bypasses Row Level Security and can manage login accounts
 * (create/delete auth users). It is extremely powerful, so it must NEVER be
 * imported into a client component or exposed to the browser — only use it
 * inside API routes / server code (files that never ship to the browser).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
