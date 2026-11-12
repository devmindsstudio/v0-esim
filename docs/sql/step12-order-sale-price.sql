-- ============================================================================
-- Step 12: Retail sale price per order  →  enables "real profit"
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- WHAT CHANGES (agreed with client):
--   • Distributors/sub-distributors now record the price they charge the end
--     customer for each eSIM they issue ("sale price").
--   • REAL profit per distributor = sale_price − total (the credit cost).
--     (VIRTUAL profit stays the top-up bonus, unchanged.)
--
--   The column is nullable: orders placed before this migration have no sale
--   price until someone backfills it, and show "—" for real profit.
-- ============================================================================

alter table public.orders
  add column if not exists sale_price numeric;

comment on column public.orders.sale_price is
  'Price the distributor charged the end customer for this eSIM. Real profit = sale_price − total (cost). Null = not recorded yet.';
