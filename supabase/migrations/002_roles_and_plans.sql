-- Life Admin: roles, plans, and feature structure (no payments)
-- Run after schema.sql, then run 003_users_architecture.sql for public.users table

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum ('user', 'founder', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_plan as enum ('free', 'family_premium', 'ai_chief_of_staff');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'user',
  plan public.user_plan not null default 'free',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_plan_idx on public.profiles (plan);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, plan)
  values (new.id, 'user', 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Plan → feature mapping (structure for entitlements; no billing)
-- ---------------------------------------------------------------------------

create table if not exists public.plan_features (
  plan public.user_plan not null,
  feature_key text not null,
  primary key (plan, feature_key)
);

insert into public.plan_features (plan, feature_key) values
  -- free
  ('free', 'category.mot'),
  ('free', 'category.passport'),
  ('free', 'category.licence'),
  ('free', 'notifications.basic'),
  ('free', 'dashboard.today'),
  -- family_premium
  ('family_premium', 'category.mot'),
  ('family_premium', 'category.passport'),
  ('family_premium', 'category.licence'),
  ('family_premium', 'category.subscriptions'),
  ('family_premium', 'category.bills'),
  ('family_premium', 'notifications.basic'),
  ('family_premium', 'notifications.priorities'),
  ('family_premium', 'dashboard.today'),
  ('family_premium', 'items.unlimited'),
  -- ai_chief_of_staff (all premium + AI placeholder)
  ('ai_chief_of_staff', 'category.mot'),
  ('ai_chief_of_staff', 'category.passport'),
  ('ai_chief_of_staff', 'category.licence'),
  ('ai_chief_of_staff', 'category.subscriptions'),
  ('ai_chief_of_staff', 'category.bills'),
  ('ai_chief_of_staff', 'notifications.basic'),
  ('ai_chief_of_staff', 'notifications.priorities'),
  ('ai_chief_of_staff', 'dashboard.today'),
  ('ai_chief_of_staff', 'items.unlimited'),
  ('ai_chief_of_staff', 'ai.assistant')
on conflict (plan, feature_key) do nothing;

-- ---------------------------------------------------------------------------
-- Role → capability mapping (admin tools; founder uses bypass in app + SQL)
-- ---------------------------------------------------------------------------

create table if not exists public.role_capabilities (
  role public.user_role not null,
  capability_key text not null,
  primary key (role, capability_key)
);

insert into public.role_capabilities (role, capability_key) values
  ('admin', 'admin.view_users'),
  ('admin', 'admin.manage_roles'),
  ('admin', 'admin.manage_plans'),
  ('founder', 'admin.view_users'),
  ('founder', 'admin.manage_roles'),
  ('founder', 'admin.manage_plans'),
  ('founder', 'founder.bypass_restrictions')
on conflict (role, capability_key) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_founder(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'founder'
  );
$$;

create or replace function public.profile_has_feature(p_user_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_founder(p_user_id)
    or exists (
      select 1
      from public.profiles pr
      join public.plan_features pf on pf.plan = pr.plan
      where pr.id = p_user_id and pf.feature_key = p_feature
    );
$$;

-- ---------------------------------------------------------------------------
-- Optional: link reminders to users (nullable for legacy anon rows)
-- ---------------------------------------------------------------------------

alter table public.life_admin_items
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists life_admin_items_user_id_idx
  on public.life_admin_items (user_id);

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- RLS: plan_features & role_capabilities (read-only reference data)
-- ---------------------------------------------------------------------------

alter table public.plan_features enable row level security;
alter table public.role_capabilities enable row level security;

create policy "Anyone can read plan features"
  on public.plan_features for select
  to anon, authenticated
  using (true);

create policy "Anyone can read role capabilities"
  on public.role_capabilities for select
  to anon, authenticated
  using (true);
