-- ============================================================================
-- Step 9: Unified transaction LEDGER (a single "book of record" at every level)
-- Run this ONCE in the Supabase SQL Editor, AFTER step8. Safe to re-run.
--
-- WHAT THIS ADDS (agreed with client):
--   • One append-only `ledger` table that EVERY money event writes to:
--       pool_load   — Ibara loads eTijwaal credit into the inventory pool
--       topup_admin — admin tops up a main distributor
--       topup_sub   — a main distributor tops up one of its sub-distributors
--       sale        — a distributor/sub spends credit to issue an eSIM
--   • Structured columns (cash, credit, commission %, commission amount) instead
--     of the free-text notes we used before — so it is reportable.
--   • The ACTOR (which admin/distributor performed it) on every row (audit).
--   • Profit = "simple spread": each row stores the commission (bonus) amount;
--     a level's profit = commission it RECEIVED − commission it GAVE, summed
--     from these rows (see the v_distributor_profit view at the bottom).
--
-- The existing wallets / wallet_transactions / credit_pool_ledger are left
-- exactly as they are. This ledger sits OVER them as the consolidated record;
-- balances are still owned by wallets. Refunds of failed orders net to zero on
-- the wallet and stay in wallet_transactions — they are NOT written here, so the
-- ledger only lists completed business events.
--
-- Because we add parameters to existing functions, their signatures change, so
-- each is dropped and recreated (and re-granted) below — same pattern as step7.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) The unified ledger table.
-- ----------------------------------------------------------------------------
create table if not exists public.ledger (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid,
  entry_type          text not null,   -- pool_load | topup_admin | topup_sub | sale
  actor_user_id       uuid,            -- auth.uid() of whoever performed it
  actor_role          text,            -- admin | distributor | sub_distributor
  from_distributor_id uuid,            -- payer/source (null when funded from the pool)
  to_distributor_id   uuid,            -- recipient of credit (the seller, for a sale)
  customer_id         uuid,            -- the buyer, for a sale
  cash_paid           numeric,         -- real cash that changed hands (offline)
  credit_amount       numeric not null,-- credit moved / spent
  commission_percent  numeric,         -- % bonus applied on a top-up
  commission_amount   numeric,         -- credit_amount − cash_paid (the bonus $)
  balance_after       numeric,         -- relevant wallet/pool balance after this row
  reference_order_id  uuid,            -- the order, for a sale
  provider_order_ref  text,            -- eTijwaal order id (POI_…), for a sale
  note                text,
  created_at          timestamptz not null default now()
);

create index if not exists ledger_to_idx      on public.ledger (to_distributor_id);
create index if not exists ledger_from_idx     on public.ledger (from_distributor_id);
create index if not exists ledger_type_idx     on public.ledger (entry_type);
create index if not exists ledger_created_idx  on public.ledger (created_at desc);

-- ----------------------------------------------------------------------------
-- 1) RLS: admins read everything; a distributor reads only the rows that
--    involve them (as payer, recipient, or seller). NOBODY writes from the
--    browser — every insert happens inside the service_role functions below,
--    and there is no update/delete policy, so the ledger is append-only.
-- ----------------------------------------------------------------------------
alter table public.ledger enable row level security;

drop policy if exists ledger_admin_select on public.ledger;
create policy ledger_admin_select on public.ledger
  for select to authenticated using (public.is_admin());

drop policy if exists ledger_own_select on public.ledger;
create policy ledger_own_select on public.ledger
  for select to authenticated using (
    from_distributor_id in (select id from public.distributors where auth_user_id = auth.uid())
    or to_distributor_id in (select id from public.distributors where auth_user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 2) admin_load_credit — now records the actor + a 'pool_load' ledger row.
-- ----------------------------------------------------------------------------
drop function if exists public.admin_load_credit(numeric, numeric, text);
create or replace function public.admin_load_credit(
  p_cash_paid     numeric,
  p_credit        numeric,
  p_note          text default null,
  p_actor_user_id uuid default null,
  p_actor_role    text default null
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

  insert into public.ledger
    (entry_type, actor_user_id, actor_role, cash_paid, credit_amount,
     commission_amount, balance_after, note)
  values
    ('pool_load', p_actor_user_id, coalesce(p_actor_role, 'admin'),
     p_cash_paid, p_credit, null, v_new,
     coalesce(nullif(p_note, ''), 'eTijwaal credit loaded'));

  return v_new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) admin_allocate_credit — actor + a 'topup_admin' ledger row.
-- ----------------------------------------------------------------------------
drop function if exists public.admin_allocate_credit(uuid, numeric, numeric, text);
create or replace function public.admin_allocate_credit(
  p_distributor_id     uuid,
  p_cash_paid          numeric,
  p_commission_percent numeric default 0,
  p_note               text default null,
  p_actor_user_id      uuid default null,
  p_actor_role         text default null
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

  insert into public.ledger
    (tenant_id, entry_type, actor_user_id, actor_role, to_distributor_id,
     cash_paid, credit_amount, commission_percent, commission_amount, balance_after, note)
  values
    (v_tenant, 'topup_admin', p_actor_user_id, coalesce(p_actor_role, 'admin'),
     p_distributor_id, p_cash_paid, v_credit, v_pct, v_credit - p_cash_paid, v_wnew,
     nullif(p_note, ''));

  return json_build_object(
    'credit', v_credit, 'walletBalance', v_wnew,
    'poolBalance', v_pool_new, 'bonusPercent', v_pct
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) distributor_allocate_credit — actor + a 'topup_sub' ledger row.
-- ----------------------------------------------------------------------------
drop function if exists public.distributor_allocate_credit(uuid, uuid, numeric, numeric, text);
create or replace function public.distributor_allocate_credit(
  p_from_distributor_id uuid,
  p_to_sub_id           uuid,
  p_cash_paid           numeric,
  p_commission_percent  numeric default 0,
  p_note                text default null,
  p_actor_user_id       uuid default null,
  p_actor_role          text default null
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

  insert into public.ledger
    (tenant_id, entry_type, actor_user_id, actor_role,
     from_distributor_id, to_distributor_id,
     cash_paid, credit_amount, commission_percent, commission_amount, balance_after, note)
  values
    (v_to_tenant, 'topup_sub', p_actor_user_id, coalesce(p_actor_role, 'distributor'),
     p_from_distributor_id, p_to_sub_id,
     p_cash_paid, v_credit, v_pct, v_credit - p_cash_paid, v_to_new,
     nullif(p_note, ''));

  return json_build_object(
    'fromBalance', v_from_new, 'toBalance', v_to_new,
    'credit', v_credit, 'bonusPercent', v_pct
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) finalize_order — actor + a 'sale' ledger row (only on a real, first-time
--    finalize, so retries don't double-log). Reads the order for its amounts.
-- ----------------------------------------------------------------------------
drop function if exists public.finalize_order(uuid, text, text, text, text, text, text, text, text, text, text, bigint);
create or replace function public.finalize_order(
  p_order_id            uuid,
  p_esim_number         text,
  p_iccid               text,
  p_qr_payload          text,
  p_activation_code     text,
  p_smdp_address        text,
  p_matching_id         text,
  p_qr_code_url         text,
  p_apple_url           text,
  p_provider_order_ref  text,
  p_provider_status     text,
  p_provider_package_id bigint,
  p_actor_user_id       uuid default null,
  p_actor_role          text default null
)
returns json
language plpgsql
as $$
declare
  v_esim_id     uuid;
  v_tenant_id   uuid;
  v_distributor uuid;
  v_customer    uuid;
  v_total       numeric;
  v_wbal        numeric;
begin
  -- Already finalized? Return the existing eSIM (safe on retry, no new ledger row).
  select id into v_esim_id from public.esims where order_id = p_order_id limit 1;
  if v_esim_id is not null then
    update public.orders
      set status = 'fulfilled',
          provider_order_ref = coalesce(provider_order_ref, p_provider_order_ref),
          provider_package_id = coalesce(provider_package_id, p_provider_package_id),
          provider_status = p_provider_status
      where id = p_order_id;
    return json_build_object('esimId', v_esim_id, 'orderId', p_order_id, 'alreadyDone', true);
  end if;

  insert into public.esims
    (order_id, iccid, esim_number, qr_payload, activation_code,
     smdp_address, matching_id, qr_code_url, apple_installation_url,
     status, delivered_via)
  values
    (p_order_id, p_iccid, p_esim_number, p_qr_payload, p_activation_code,
     p_smdp_address, p_matching_id, p_qr_code_url, p_apple_url,
     'issued', 'onscreen')
  returning id into v_esim_id;

  update public.orders
    set status = 'fulfilled',
        provider_order_ref = p_provider_order_ref,
        provider_package_id = p_provider_package_id,
        provider_status = p_provider_status
    where id = p_order_id
    returning tenant_id, distributor_id, customer_id, total
      into v_tenant_id, v_distributor, v_customer, v_total;

  -- Seller's wallet balance after the sale (the debit happened in reserve_order).
  select balance into v_wbal from public.wallets where distributor_id = v_distributor;

  insert into public.ledger
    (tenant_id, entry_type, actor_user_id, actor_role,
     from_distributor_id, customer_id,
     credit_amount, balance_after, reference_order_id, provider_order_ref, note)
  values
    (v_tenant_id, 'sale', p_actor_user_id, coalesce(p_actor_role, 'distributor'),
     v_distributor, v_customer,
     v_total, v_wbal, p_order_id, p_provider_order_ref, 'eSIM sale');

  return json_build_object('esimId', v_esim_id, 'orderId', p_order_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) A convenience view: profit per distributor (simple-spread model).
--    profit = commission RECEIVED on its own top-ups − commission it GAVE to
--    its subs. Admin-facing; runs with the caller's RLS (security_invoker).
-- ----------------------------------------------------------------------------
create or replace view public.v_distributor_profit
with (security_invoker = true) as
select
  d.id   as distributor_id,
  d.name as distributor_name,
  d.role as role,
  coalesce(sum(l.commission_amount) filter (where l.to_distributor_id   = d.id), 0) as commission_received,
  coalesce(sum(l.commission_amount) filter (where l.from_distributor_id = d.id), 0) as commission_given,
  coalesce(sum(l.commission_amount) filter (where l.to_distributor_id   = d.id), 0)
    - coalesce(sum(l.commission_amount) filter (where l.from_distributor_id = d.id), 0) as net_profit,
  coalesce(sum(l.credit_amount) filter (where l.entry_type = 'sale' and l.from_distributor_id = d.id), 0) as credit_sold_as_esims
from public.distributors d
left join public.ledger l
  on l.to_distributor_id = d.id or l.from_distributor_id = d.id
group by d.id, d.name, d.role;

-- The view is security_invoker, so ledger RLS still restricts rows per caller;
-- authenticated needs SELECT on the view itself to query it.
grant select on public.v_distributor_profit to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Only the server (service_role) may run the money functions.
-- ----------------------------------------------------------------------------
revoke all on function public.admin_load_credit(numeric, numeric, text, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_allocate_credit(uuid, numeric, numeric, text, uuid, text) from public, anon, authenticated;
revoke all on function public.distributor_allocate_credit(uuid, uuid, numeric, numeric, text, uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_order(uuid, text, text, text, text, text, text, text, text, text, text, bigint, uuid, text) from public, anon, authenticated;

grant execute on function public.admin_load_credit(numeric, numeric, text, uuid, text) to service_role;
grant execute on function public.admin_allocate_credit(uuid, numeric, numeric, text, uuid, text) to service_role;
grant execute on function public.distributor_allocate_credit(uuid, uuid, numeric, numeric, text, uuid, text) to service_role;
grant execute on function public.finalize_order(uuid, text, text, text, text, text, text, text, text, text, text, bigint, uuid, text) to service_role;
