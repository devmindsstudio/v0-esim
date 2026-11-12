-- ============================================================================
-- Step 11: Default commission % (per-level), pre-filled on top-ups.
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
--
-- The commission % is still entered per top-up (step7), but now a DEFAULT
-- pre-fills the field so it doesn't have to be typed every time:
--   • Admin → distributor top-ups pre-fill from a GLOBAL default (app_settings).
--   • Distributor → sub-distributor top-ups pre-fill from that distributor's
--     OWN default (distributors.default_commission_percent).
-- Either can still be changed for a specific top-up. The actual allocate
-- functions are unchanged — the default is only a UI pre-fill.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Global settings singleton — holds the admin's default commission %.
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id                          int primary key default 1,
  default_commission_percent  numeric not null default 0
                                check (default_commission_percent >= 0 and default_commission_percent <= 100),
  updated_at                  timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Only admins read it (the value is written by the server via service_role).
alter table public.app_settings enable row level security;
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 1) Each distributor's own default commission % (for topping up their subs).
--    Additive, defaults to 0. A distributor reads their own row (RLS already
--    allows that); writes go through the server (service_role).
-- ----------------------------------------------------------------------------
alter table public.distributors
  add column if not exists default_commission_percent numeric not null default 0;
alter table public.distributors
  drop constraint if exists distributors_default_commission_range;
alter table public.distributors
  add constraint distributors_default_commission_range
  check (default_commission_percent >= 0 and default_commission_percent <= 100);
