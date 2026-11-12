import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in the BROWSER (client components).
 *
 * - Reads the project URL + anon (public) key from environment variables.
 * - The anon key is safe to expose in the browser: it only allows what your
 *   Row Level Security rules permit. Real protection comes from RLS (added later).
 *
 * Usage in a component:
 *   const supabase = createClient()
 *   await supabase.auth.signInWithPassword({ email, password })
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
