-- ============================================================================
-- Step 4b: Lock down the MONEY tables with Row-Level Security (RLS)
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- WHY: without RLS, a logged-in user could open the browser console and run
--   supabase.from('wallets').update({ balance: 999999 })  — minting credit and
--   bypassing every check in our allocation functions. The functions REVOKE was
--   necessary but NOT sufficient. This closes that hole:
--     • wallets / wallet_transactions get RLS with READ-ONLY policies.
--     • No INSERT/UPDATE/DELETE policy exists → the browser (anon/authenticated)
--       can never write these tables.
--     • service_role BYPASSES RLS, so our server routes + allocation RPCs still
--       work exactly as before (that is the ONLY write path now).
--
-- SCOPE: this covers the money tables only. `distributors` and `customers` are
-- still written directly from the browser (status changes, add-customer), so
-- they are hardened in a later step once those writes move server-side.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER so they can read admins/distributors even
-- after those tables get their own RLS later (no recursion, no policy loops).
-- ----------------------------------------------------------------------------
create or replace function public.current_distributor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.distributors where auth_user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where auth_user_id = auth.uid())
$$;

-- ----------------------------------------------------------------------------
-- wallets: readable by the admin (all), the owner, and a parent for their subs.
-- No write policy → browser cannot write. service_role bypasses RLS.
-- ----------------------------------------------------------------------------
alter table public.wallets enable row level security;

drop policy if exists wallets_select on public.wallets;
create policy wallets_select on public.wallets
  for select
  to authenticated
  using (
    public.is_admin()
    or distributor_id = public.current_distributor_id()
    or distributor_id in (
      select id from public.distributors
      where parent_id = public.current_distributor_id()
    )
  );

-- ----------------------------------------------------------------------------
-- wallet_transactions: you can read a ledger row iff you can read its wallet.
-- The subquery below is itself subject to the wallets policy above, so this
-- automatically covers admin (sees all wallets), owner, and parent-of-sub.
-- ----------------------------------------------------------------------------
alter table public.wallet_transactions enable row level security;

drop policy if exists wtx_select on public.wallet_transactions;
create policy wtx_select on public.wallet_transactions
  for select
  to authenticated
  using (
    wallet_id in (select id from public.wallets)
  );

-- ============================================================================
-- ROLLBACK (only if a wallet/history page suddenly shows empty after this):
--   alter table public.wallets              disable row level security;
--   alter table public.wallet_transactions  disable row level security;
-- ============================================================================
