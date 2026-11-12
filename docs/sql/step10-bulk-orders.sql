-- ============================================================================
-- Step 10: Bulk eSIM orders — group a batch of orders under one batch_id.
-- Run this ONCE in the Supabase SQL Editor, AFTER step8/step9. Safe to re-run.
--
-- Bulk ordering issues N eSIMs of the SAME package to ONE buyer. Each eSIM is
-- still its own order row (eTijwaal issues one eSIM per call), but they now
-- share a batch_id so a batch can be grouped / re-downloaded / emailed together.
--
-- Only change: reserve_order gains an optional p_batch_id. It's additive
-- (defaults to null), so single orders keep working unchanged.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Group column for bulk batches (additive, nullable).
-- ----------------------------------------------------------------------------
alter table public.orders add column if not exists batch_id uuid;
create index if not exists orders_batch_idx on public.orders (batch_id);

-- ----------------------------------------------------------------------------
-- 1) reserve_order — same as step8, plus an optional p_batch_id stamped on the
--    order row. (Signature changes, so drop the old 6-arg version first.)
-- ----------------------------------------------------------------------------
drop function if exists public.reserve_order(uuid, uuid, bigint, text, text, numeric);
create or replace function public.reserve_order(
  p_distributor_id uuid,
  p_customer_id    uuid,
  p_package_id     bigint,
  p_package_title  text,
  p_currency       text,
  p_price          numeric,
  p_batch_id       uuid default null
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
     currency, unit_price, quantity, total, status, payment_ref, provider_status,
     batch_id)
  values
    (v_tenant_id, p_distributor_id, p_customer_id, p_package_id, p_package_title,
     p_currency, p_price, 1, p_price, 'pending', 'ETIJWAAL', 'reserved',
     p_batch_id)
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
-- 2) Only the server (service_role) may run it.
-- ----------------------------------------------------------------------------
revoke all on function public.reserve_order(uuid, uuid, bigint, text, text, numeric, uuid) from public, anon, authenticated;
grant execute on function public.reserve_order(uuid, uuid, bigint, text, text, numeric, uuid) to service_role;
