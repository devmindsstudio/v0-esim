-- ============================================================================
-- Step 4: Wallet credit allocation (atomic, ledger-backed) — HARDENED
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Money math + ledger writes happen inside these functions in a single
-- transaction (any error rolls the whole thing back) and lock the wallet rows
-- (FOR UPDATE) so two allocations can't race and double-spend.
--
-- NOTE: functions are the ONLY intended write path, but they are not the ONLY
-- POSSIBLE one until RLS is enabled — see docs/sql/step4b-rls-lockdown.sql.
-- ============================================================================

-- 0) Database-level backstops. Even if application code has a bug (or someone
--    writes the table directly), these constraints refuse bad data.
alter table public.wallets
  drop constraint if exists wallets_balance_nonneg;
alter table public.wallets
  add constraint wallets_balance_nonneg check (balance >= 0);

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_amount_positive;
alter table public.wallet_transactions
  add constraint wallet_transactions_amount_positive check (amount > 0);

-- ----------------------------------------------------------------------------
-- 1) ADMIN → distributor: add credit to a wallet + write one 'allocation' row.
--    Refuses to exceed the distributor's credit_limit or an absolute ceiling.
-- ----------------------------------------------------------------------------
create or replace function public.admin_allocate_credit(
  p_distributor_id uuid,
  p_amount numeric,
  p_note text default null
)
returns numeric
language plpgsql
as $$
declare
  v_wallet_id   uuid;
  v_tenant_id   uuid;
  v_balance     numeric;
  v_new_balance numeric;
  v_limit       numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;
  if p_amount > 10000000 then
    raise exception 'Amount exceeds the maximum allowed per allocation';
  end if;

  -- Lock the wallet row so two allocations can't race.
  select id, tenant_id, balance
    into v_wallet_id, v_tenant_id, v_balance
    from public.wallets
    where distributor_id = p_distributor_id
    for update;

  if v_wallet_id is null then
    raise exception 'Wallet not found for distributor %', p_distributor_id;
  end if;

  select credit_limit into v_limit
    from public.distributors
    where id = p_distributor_id;

  v_new_balance := v_balance + p_amount;

  if v_limit is not null and v_new_balance > v_limit then
    raise exception 'Allocation would exceed the credit limit of %', v_limit;
  end if;

  update public.wallets
    set balance = v_new_balance, updated_at = now()
    where id = v_wallet_id;

  insert into public.wallet_transactions
    (tenant_id, wallet_id, type, amount, balance_after, note)
  values
    (v_tenant_id, v_wallet_id, 'allocation', p_amount, v_new_balance,
     coalesce(nullif(p_note, ''), 'Credit allocated by admin'));

  return v_new_balance;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) MAIN DISTRIBUTOR → sub-distributor: debit the sender, credit the sub,
--    write BOTH ledger rows atomically. Refuses unless the recipient is truly
--    the caller's own sub-distributor, on insufficient balance, or if it would
--    exceed the sub's credit_limit.
-- ----------------------------------------------------------------------------
create or replace function public.distributor_allocate_credit(
  p_from_distributor_id uuid,
  p_to_sub_id uuid,
  p_amount numeric,
  p_note text default null
)
returns json
language plpgsql
as $$
declare
  v_from_wallet  uuid;
  v_from_tenant  uuid;
  v_from_balance numeric;
  v_to_wallet    uuid;
  v_to_tenant    uuid;
  v_to_balance   numeric;
  v_from_new     numeric;
  v_to_new       numeric;
  v_to_parent    uuid;
  v_to_role      text;
  v_to_limit     numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;
  if p_amount > 10000000 then
    raise exception 'Amount exceeds the maximum allowed per allocation';
  end if;
  if p_from_distributor_id = p_to_sub_id then
    raise exception 'Cannot allocate to the same wallet';
  end if;

  -- Defense in depth: the recipient MUST be the caller's own sub-distributor,
  -- regardless of what the API route checked.
  select parent_id, role, credit_limit
    into v_to_parent, v_to_role, v_to_limit
    from public.distributors
    where id = p_to_sub_id;

  if v_to_role is distinct from 'sub_distributor'
     or v_to_parent is distinct from p_from_distributor_id then
    raise exception 'Recipient is not your sub-distributor';
  end if;

  -- Lock BOTH wallet rows, each by its own single-row statement, in a canonical
  -- order (by distributor_id) so concurrent transfers can never deadlock.
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

  if v_from_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  v_from_new := v_from_balance - p_amount;
  v_to_new   := v_to_balance + p_amount;

  if v_to_limit is not null and v_to_new > v_to_limit then
    raise exception 'Allocation would exceed the sub-distributor''s credit limit of %', v_to_limit;
  end if;

  update public.wallets set balance = v_from_new, updated_at = now() where id = v_from_wallet;
  update public.wallets set balance = v_to_new,   updated_at = now() where id = v_to_wallet;

  insert into public.wallet_transactions
    (tenant_id, wallet_id, type, amount, balance_after, note)
  values
    (v_from_tenant, v_from_wallet, 'debit', p_amount, v_from_new,
     coalesce(nullif(p_note, ''), 'Credit allocated to sub-distributor'));

  insert into public.wallet_transactions
    (tenant_id, wallet_id, type, amount, balance_after, note)
  values
    (v_to_tenant, v_to_wallet, 'allocation', p_amount, v_to_new,
     coalesce(nullif(p_note, ''), 'Credit received from distributor'));

  return json_build_object('fromBalance', v_from_new, 'toBalance', v_to_new);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) Lock these down: only the server (service_role) may move money — never a
--    browser using the anon key.
-- ----------------------------------------------------------------------------
revoke all on function public.admin_allocate_credit(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.distributor_allocate_credit(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.admin_allocate_credit(uuid, numeric, text) to service_role;
grant execute on function public.distributor_allocate_credit(uuid, uuid, numeric, text) to service_role;
