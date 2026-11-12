-- ============================================================================
-- Step 8: Real eSIM provisioning via eTijwaal (charge-first saga).
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
--
-- Because eTijwaal has NO cancel endpoint, we charge FIRST, then provision:
--   1. reserve_order()  → lock wallet, verify customer, debit, create a
--                          'pending' order + debit ledger row  (atomic)
--   2. app calls eTijwaal Submit Order (validate or transaction)
--   3a. success → finalize_order()  attaches the eSIM, marks 'fulfilled'
--   3b. failure → refund_order()    credits the wallet back, marks 'failed'
--
-- This supersedes place_order() from step5 (left in place, now unused).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Extra columns for real eSIM credentials + provider tracking (additive).
-- ----------------------------------------------------------------------------
alter table public.esims  add column if not exists smdp_address           text;
alter table public.esims  add column if not exists matching_id            text;
alter table public.esims  add column if not exists qr_code_url            text;
alter table public.esims  add column if not exists apple_installation_url text;
alter table public.orders add column if not exists provider_order_ref     text;
alter table public.orders add column if not exists provider_status        text;
-- The package id eTijwaal actually fulfilled (in dev this is the test package,
-- e.g. 31565). Distinct from orders.package_id, which is the REAL catalogue
-- package the distributor selected + sold + was charged for.
alter table public.orders add column if not exists provider_package_id    bigint;

-- Orders now use statuses 'pending' | 'fulfilled' | 'failed'. If a CHECK
-- constraint on orders.status exists (from the initial schema) it may forbid
-- the new values — drop it so the app controls the lifecycle.
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then
    execute 'alter table public.orders drop constraint ' || quote_ident(c);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) reserve_order: debit + create a PENDING order (before we call eTijwaal).
-- ----------------------------------------------------------------------------
create or replace function public.reserve_order(
  p_distributor_id uuid,
  p_customer_id    uuid,
  p_package_id     bigint,
  p_package_title  text,
  p_currency       text,
  p_price          numeric
)
returns json
language plpgsql
as $$
declare
  v_wallet_id   uuid;
  v_tenant_id   uuid;
  v_balance     numeric;
  v_new_balance numeric;
  v_order_id    uuid;
  v_cust        int;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'Invalid package price';
  end if;
  if p_price > 1000000 then
    raise exception 'Price exceeds the maximum allowed';
  end if;

  -- Lock the buyer's wallet so the balance can't change under us.
  select id, tenant_id, balance
    into v_wallet_id, v_tenant_id, v_balance
    from public.wallets
    where distributor_id = p_distributor_id
    for update;
  if v_wallet_id is null then
    raise exception 'Wallet not found';
  end if;

  -- The customer must belong to THIS distributor.
  select 1 into v_cust
    from public.customers
    where id = p_customer_id and distributor_id = p_distributor_id;
  if v_cust is null then
    raise exception 'Customer does not belong to this distributor';
  end if;

  if v_balance < p_price then
    raise exception 'Insufficient balance';
  end if;

  v_new_balance := v_balance - p_price;

  insert into public.orders
    (tenant_id, distributor_id, customer_id, package_id, package_title,
     currency, unit_price, quantity, total, status, payment_ref, provider_status)
  values
    (v_tenant_id, p_distributor_id, p_customer_id, p_package_id, p_package_title,
     p_currency, p_price, 1, p_price, 'pending', 'ETIJWAAL', 'reserved')
  returning id into v_order_id;

  update public.wallets
    set balance = v_new_balance, updated_at = now()
    where id = v_wallet_id;

  insert into public.wallet_transactions
    (tenant_id, wallet_id, type, amount, balance_after, reference_order_id, note)
  values
    (v_tenant_id, v_wallet_id, 'debit', p_price, v_new_balance, v_order_id,
     'Order: ' || p_package_title);

  return json_build_object(
    'orderId', v_order_id,
    'walletBalance', v_new_balance,
    'total', p_price
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) finalize_order: attach the issued eSIM + mark the order fulfilled.
--    Idempotent — if the order already has an eSIM, it just returns it.
--    (Drop the earlier 11-arg version first so we don't leave two overloads.)
-- ----------------------------------------------------------------------------
drop function if exists public.finalize_order(uuid, text, text, text, text, text, text, text, text, text, text);
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
  p_provider_package_id bigint
)
returns json
language plpgsql
as $$
declare
  v_esim_id uuid;
begin
  -- Already finalized? Return the existing eSIM (safe on retry).
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
    where id = p_order_id;

  return json_build_object('esimId', v_esim_id, 'orderId', p_order_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) refund_order: eTijwaal failed after we debited → credit the wallet back.
--    Only refunds a 'pending' order (guards against double refunds).
-- ----------------------------------------------------------------------------
create or replace function public.refund_order(
  p_order_id uuid,
  p_reason   text default null
)
returns json
language plpgsql
as $$
declare
  v_tenant_id   uuid;
  v_distributor uuid;
  v_total       numeric;
  v_status      text;
  v_wallet_id   uuid;
  v_balance     numeric;
  v_new_balance numeric;
begin
  select tenant_id, distributor_id, total, status
    into v_tenant_id, v_distributor, v_total, v_status
    from public.orders
    where id = p_order_id
    for update;
  if v_distributor is null then
    raise exception 'Order not found';
  end if;
  if v_status is distinct from 'pending' then
    -- Nothing to refund (already fulfilled or already refunded).
    return json_build_object('orderId', p_order_id, 'refunded', false);
  end if;

  select id, balance into v_wallet_id, v_balance
    from public.wallets
    where distributor_id = v_distributor
    for update;
  if v_wallet_id is null then
    raise exception 'Wallet not found';
  end if;

  v_new_balance := v_balance + v_total;

  update public.wallets
    set balance = v_new_balance, updated_at = now()
    where id = v_wallet_id;

  insert into public.wallet_transactions
    (tenant_id, wallet_id, type, amount, balance_after, reference_order_id, note)
  values
    (v_tenant_id, v_wallet_id, 'refund', v_total, v_new_balance, p_order_id,
     coalesce(nullif(p_reason, ''), 'Order failed — credit refunded'));

  update public.orders
    set status = 'failed', provider_status = 'failed'
    where id = p_order_id;

  return json_build_object('orderId', p_order_id, 'refunded', true, 'walletBalance', v_new_balance);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Only the server (service_role) may run these.
-- ----------------------------------------------------------------------------
revoke all on function public.reserve_order(uuid, uuid, bigint, text, text, numeric) from public, anon, authenticated;
revoke all on function public.finalize_order(uuid, text, text, text, text, text, text, text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.refund_order(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_order(uuid, uuid, bigint, text, text, numeric) to service_role;
grant execute on function public.finalize_order(uuid, text, text, text, text, text, text, text, text, text, text, bigint) to service_role;
grant execute on function public.refund_order(uuid, text) to service_role;
