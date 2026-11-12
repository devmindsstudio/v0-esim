-- ============================================================================
-- Step 7: Commission % moves to per-TOP-UP (no saved rate on the distributor)
-- Run this ONCE in the Supabase SQL Editor, AFTER step6. Safe to re-run.
--
-- WHAT CHANGES (agreed with client):
--   • Distributors/sub-distributors are created WITHOUT a commission %.
--   • The commission % is entered on each top-up (add-credit) instead, so it
--     can be raised or lowered freely every time credit is added.
--         credit received = cash paid × (1 + commission% for THIS top-up)
--   • The per-distributor `commission_percent` column from step6 is therefore
--     removed — there is no longer a stored rate.
--
-- The credit_pool / credit_pool_ledger / admin_load_credit from step6 are
-- unchanged. Only the two allocate functions change (they now take the % as a
-- parameter instead of reading it from the distributor row).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Retire the stored commission_percent column (no longer used).
-- ----------------------------------------------------------------------------
alter table public.distributors drop constraint if exists distributors_commission_range;
alter table public.distributors drop column if exists commission_percent;

-- ----------------------------------------------------------------------------
-- 1) ADMIN → distributor. Now takes the commission % for THIS top-up.
--    credit = cash × (1 + %), drawn from the pool.
-- ----------------------------------------------------------------------------
drop function if exists public.admin_allocate_credit(uuid, numeric, text);
drop function if exists public.admin_allocate_credit(uuid, numeric, numeric, text);
create or replace function public.admin_allocate_credit(
  p_distributor_id     uuid,
  p_cash_paid          numeric,
  p_commission_percent numeric default 0,
  p_note               text default null
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

  v_pct := coalesce(p_commission_percent, 0);
  if v_pct < 0 or v_pct > 100 then
    raise exception 'Commission %% must be between 0 and 100';
  end if;

  select role into v_role from public.distributors where id = p_distributor_id;
  if v_role is distinct from 'distributor' then
    raise exception 'Credit can only be loaded to a main distributor here';
  end if;

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
-- 2) MAIN DISTRIBUTOR → sub. Now takes the commission % for THIS top-up.
--    The sub gets cash × (1 + %), debited from the Master's wallet.
-- ----------------------------------------------------------------------------
drop function if exists public.distributor_allocate_credit(uuid, uuid, numeric, text);
drop function if exists public.distributor_allocate_credit(uuid, uuid, numeric, numeric, text);
create or replace function public.distributor_allocate_credit(
  p_from_distributor_id uuid,
  p_to_sub_id           uuid,
  p_cash_paid           numeric,
  p_commission_percent  numeric default 0,
  p_note                text default null
)
returns json
language plpgsql
as $$
declare
  v_to_parent    uuid;
  v_to_role      text;
  v_pct          numeric;
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

  v_pct := coalesce(p_commission_percent, 0);
  if v_pct < 0 or v_pct > 100 then
    raise exception 'Commission %% must be between 0 and 100';
  end if;

  select parent_id, role into v_to_parent, v_to_role
    from public.distributors where id = p_to_sub_id;

  if v_to_role is distinct from 'sub_distributor'
     or v_to_parent is distinct from p_from_distributor_id then
    raise exception 'Recipient is not your sub-distributor';
  end if;

  v_credit := round(p_cash_paid * (1 + v_pct / 100.0), 2);

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
                   'Credit received: paid $' || p_cash_paid::text || ' (+' || v_pct::text || '%)'));

  return json_build_object(
    'fromBalance', v_from_new, 'toBalance', v_to_new,
    'credit', v_credit, 'bonusPercent', v_pct
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) Only the server (service_role) may run these.
-- ----------------------------------------------------------------------------
revoke all on function public.admin_allocate_credit(uuid, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.distributor_allocate_credit(uuid, uuid, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.admin_allocate_credit(uuid, numeric, numeric, text) to service_role;
grant execute on function public.distributor_allocate_credit(uuid, uuid, numeric, numeric, text) to service_role;
