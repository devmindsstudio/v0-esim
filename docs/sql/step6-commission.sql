-- ============================================================================
-- Step 6: Commission / bonus-credit model  +  Ibara credit pool
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- WHAT CHANGES (agreed with client):
--   • Credit is topped up level by level. When someone pays cash, they receive
--     MORE credit than the cash, by a BONUS % ("commission"):
--         credit received = cash paid × (1 + bonus%)
--   • Ibara sets each Master distributor's bonus %; a Master sets each Sub's
--     bonus % (must be ≤ the Master's own — enforced in the app).
--     Each level's profit is the SPREAD between the % it got and the % it gives.
--   • Ibara buys credit from eTijwaal OUTSIDE the system, then LOADS it into a
--     single "inventory" credit pool here. Admin allocations draw from that pool.
--   • The per-distributor CREDIT LIMIT is removed (no longer used anywhere).
--
-- NOTE: the pool starts at 0. After running this, the admin must "Load credit"
-- before allocating. Existing wallet balances are left untouched.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Schema: add commission_percent, retire credit_limit.
-- ----------------------------------------------------------------------------
alter table public.distributors
  add column if not exists commission_percent numeric not null default 0;

alter table public.distributors
  drop constraint if exists distributors_commission_range;
alter table public.distributors
  add constraint distributors_commission_range
  check (commission_percent >= 0 and commission_percent <= 100);

-- credit_limit is retired — make it optional so nothing depends on it anymore.
alter table public.distributors alter column credit_limit drop not null;
alter table public.distributors alter column credit_limit set default null;

-- ----------------------------------------------------------------------------
-- 1) The Ibara credit pool ("inventory wallet"): a single row.
-- ----------------------------------------------------------------------------
create table if not exists public.credit_pool (
  id           int primary key default 1,
  balance      numeric not null default 0 check (balance >= 0),
  total_loaded numeric not null default 0,
  updated_at   timestamptz not null default now(),
  constraint credit_pool_singleton check (id = 1)
);
insert into public.credit_pool (id) values (1) on conflict (id) do nothing;

-- Ledger for the pool: every load (from eTijwaal) and every allocation out.
create table if not exists public.credit_pool_ledger (
  id             uuid primary key default gen_random_uuid(),
  type           text not null,                 -- 'load' | 'allocation'
  cash_paid      numeric,                        -- cash that changed hands (offline)
  credit_amount  numeric not null,               -- credit added/removed
  balance_after  numeric not null,               -- pool balance after this row
  distributor_id uuid,                            -- recipient (for 'allocation')
  note           text,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2) ADMIN loads credit into the pool (records an eTijwaal purchase).
--    p_cash_paid = what Ibara paid eTijwaal (for the margin record; optional)
--    p_credit    = credit value received (what actually enters the pool)
-- ----------------------------------------------------------------------------
create or replace function public.admin_load_credit(
  p_cash_paid numeric,
  p_credit    numeric,
  p_note      text default null
)
returns numeric
language plpgsql
as $$
declare
  v_new numeric;
begin
  if p_credit is null or p_credit <= 0 then
    raise exception 'Credit amount must be greater than 0';
  end if;
  if p_credit > 100000000 then
    raise exception 'Credit exceeds the maximum allowed';
  end if;

  update public.credit_pool
    set balance = balance + p_credit,
        total_loaded = total_loaded + p_credit,
        updated_at = now()
    where id = 1
    returning balance into v_new;

  if v_new is null then
    raise exception 'Credit pool not initialised';
  end if;

  insert into public.credit_pool_ledger (type, cash_paid, credit_amount, balance_after, note)
  values ('load', p_cash_paid, p_credit, v_new,
          coalesce(nullif(p_note, ''), 'eTijwaal credit loaded'));

  return v_new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) ADMIN → distributor. Input is the CASH the distributor paid; the credit is
--    cash × (1 + their bonus%), drawn from the pool. No credit-limit check.
--    (Param renamed cash → drop first, since create-or-replace can't rename.)
-- ----------------------------------------------------------------------------
drop function if exists public.admin_allocate_credit(uuid, numeric, text);
create or replace function public.admin_allocate_credit(
  p_distributor_id uuid,
  p_cash_paid      numeric,
  p_note           text default null
)
returns json
language plpgsql
as $$
declare
  v_pct       numeric;
  v_role      text;
  v_credit    numeric;
  v_wallet_id uuid;
  v_tenant    uuid;
  v_wbal      numeric;
  v_wnew      numeric;
  v_pool      numeric;
  v_pool_new  numeric;
begin
  if p_cash_paid is null or p_cash_paid <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;
  if p_cash_paid > 10000000 then
    raise exception 'Amount exceeds the maximum allowed per allocation';
  end if;

  select commission_percent, role into v_pct, v_role
    from public.distributors where id = p_distributor_id;
  if v_role is distinct from 'distributor' then
    raise exception 'Credit can only be loaded to a main distributor here';
  end if;
  v_pct := coalesce(v_pct, 0);
  v_credit := round(p_cash_paid * (1 + v_pct / 100.0), 2);

  -- Lock the pool first (always id=1 → consistent order, no deadlock).
  select balance into v_pool from public.credit_pool where id = 1 for update;
  if v_pool is null then raise exception 'Credit pool not initialised'; end if;
  if v_pool < v_credit then
    raise exception 'Not enough credit in the inventory pool (need %, have %)', v_credit, v_pool;
  end if;

  select id, tenant_id, balance into v_wallet_id, v_tenant, v_wbal
    from public.wallets where distributor_id = p_distributor_id for update;
  if v_wallet_id is null then
    raise exception 'Wallet not found for distributor %', p_distributor_id;
  end if;

  v_pool_new := v_pool - v_credit;
  v_wnew := v_wbal + v_credit;

  update public.credit_pool set balance = v_pool_new, updated_at = now() where id = 1;
  update public.wallets set balance = v_wnew, updated_at = now() where id = v_wallet_id;

  insert into public.wallet_transactions (tenant_id, wallet_id, type, amount, balance_after, note)
  values (v_tenant, v_wallet_id, 'allocation', v_credit, v_wnew,
          coalesce(nullif(p_note, ''),
                   'Credit purchase: paid $' || p_cash_paid::text || ' (+' || v_pct::text || '%)'));

  insert into public.credit_pool_ledger (type, cash_paid, credit_amount, balance_after, distributor_id, note)
  values ('allocation', p_cash_paid, v_credit, v_pool_new, p_distributor_id, nullif(p_note, ''));

  return json_build_object(
    'credit', v_credit, 'walletBalance', v_wnew,
    'poolBalance', v_pool_new, 'bonusPercent', v_pct
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) MAIN DISTRIBUTOR → sub. Input is the CASH the sub paid; the sub receives
--    cash × (1 + sub bonus%), debited from the Master's wallet. No limit check.
-- ----------------------------------------------------------------------------
drop function if exists public.distributor_allocate_credit(uuid, uuid, numeric, text);
create or replace function public.distributor_allocate_credit(
  p_from_distributor_id uuid,
  p_to_sub_id           uuid,
  p_cash_paid           numeric,
  p_note                text default null
)
returns json
language plpgsql
as $$
declare
  v_to_parent    uuid;
  v_to_role      text;
  v_to_pct       numeric;
  v_credit       numeric;
  v_from_wallet  uuid;
  v_from_tenant  uuid;
  v_from_balance numeric;
  v_from_new     numeric;
  v_to_wallet    uuid;
  v_to_tenant    uuid;
  v_to_balance   numeric;
  v_to_new       numeric;
begin
  if p_cash_paid is null or p_cash_paid <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;
  if p_cash_paid > 10000000 then
    raise exception 'Amount exceeds the maximum allowed per allocation';
  end if;
  if p_from_distributor_id = p_to_sub_id then
    raise exception 'Cannot allocate to the same wallet';
  end if;

  select parent_id, role, commission_percent
    into v_to_parent, v_to_role, v_to_pct
    from public.distributors where id = p_to_sub_id;

  if v_to_role is distinct from 'sub_distributor'
     or v_to_parent is distinct from p_from_distributor_id then
    raise exception 'Recipient is not your sub-distributor';
  end if;
  v_to_pct := coalesce(v_to_pct, 0);
  v_credit := round(p_cash_paid * (1 + v_to_pct / 100.0), 2);

  -- Lock BOTH wallets in a canonical order (by distributor_id) → no deadlock.
  if p_from_distributor_id < p_to_sub_id then
    select id, tenant_id, balance into v_from_wallet, v_from_tenant, v_from_balance
      from public.wallets where distributor_id = p_from_distributor_id for update;
    select id, tenant_id, balance into v_to_wallet, v_to_tenant, v_to_balance
      from public.wallets where distributor_id = p_to_sub_id for update;
  else
    select id, tenant_id, balance into v_to_wallet, v_to_tenant, v_to_balance
      from public.wallets where distributor_id = p_to_sub_id for update;
    select id, tenant_id, balance into v_from_wallet, v_from_tenant, v_from_balance
      from public.wallets where distributor_id = p_from_distributor_id for update;
  end if;

  if v_from_wallet is null then raise exception 'Sender wallet not found'; end if;
  if v_to_wallet   is null then raise exception 'Recipient wallet not found'; end if;
  if v_from_balance < v_credit then raise exception 'Insufficient balance'; end if;

  v_from_new := v_from_balance - v_credit;
  v_to_new   := v_to_balance + v_credit;

  update public.wallets set balance = v_from_new, updated_at = now() where id = v_from_wallet;
  update public.wallets set balance = v_to_new,   updated_at = now() where id = v_to_wallet;

  insert into public.wallet_transactions (tenant_id, wallet_id, type, amount, balance_after, note)
  values (v_from_tenant, v_from_wallet, 'debit', v_credit, v_from_new,
          coalesce(nullif(p_note, ''), 'Credit sold to sub-distributor'));

  insert into public.wallet_transactions (tenant_id, wallet_id, type, amount, balance_after, note)
  values (v_to_tenant, v_to_wallet, 'allocation', v_credit, v_to_new,
          coalesce(nullif(p_note, ''),
                   'Credit received: paid $' || p_cash_paid::text || ' (+' || v_to_pct::text || '%)'));

  return json_build_object(
    'fromBalance', v_from_new, 'toBalance', v_to_new,
    'credit', v_credit, 'bonusPercent', v_to_pct
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) RLS for the new tables: admin can read; nobody writes from the browser
--    (service_role bypasses RLS, so the server routes/functions still work).
-- ----------------------------------------------------------------------------
alter table public.credit_pool enable row level security;
drop policy if exists credit_pool_select on public.credit_pool;
create policy credit_pool_select on public.credit_pool
  for select to authenticated using (public.is_admin());

alter table public.credit_pool_ledger enable row level security;
drop policy if exists credit_pool_ledger_select on public.credit_pool_ledger;
create policy credit_pool_ledger_select on public.credit_pool_ledger
  for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6) Only the server (service_role) may run these.
-- ----------------------------------------------------------------------------
revoke all on function public.admin_load_credit(numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.admin_allocate_credit(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.distributor_allocate_credit(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.admin_load_credit(numeric, numeric, text) to service_role;
grant execute on function public.admin_allocate_credit(uuid, numeric, text) to service_role;
grant execute on function public.distributor_allocate_credit(uuid, uuid, numeric, text) to service_role;
