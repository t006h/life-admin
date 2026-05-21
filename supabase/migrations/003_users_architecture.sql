-- Life Admin: users table architecture (no billing)
-- Run after schema.sql (002 is optional — this file includes required prerequisites)

-- ---------------------------------------------------------------------------
-- Prerequisites (from 002 — safe if already applied)
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

create table if not exists public.plan_features (
  plan public.user_plan not null,
  feature_key text not null,
  primary key (plan, feature_key)
);

create table if not exists public.role_capabilities (
  role public.user_role not null,
  capability_key text not null,
  primary key (role, capability_key)
);

insert into public.plan_features (plan, feature_key) values
  ('free', 'category.mot'),
  ('free', 'category.passport'),
  ('free', 'category.licence'),
  ('free', 'notifications.basic'),
  ('free', 'dashboard.today'),
  ('family_premium', 'category.mot'),
  ('family_premium', 'category.passport'),
  ('family_premium', 'category.licence'),
  ('family_premium', 'category.subscriptions'),
  ('family_premium', 'category.bills'),
  ('family_premium', 'notifications.basic'),
  ('family_premium', 'notifications.priorities'),
  ('family_premium', 'dashboard.today'),
  ('family_premium', 'items.unlimited'),
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
-- Users (primary app user record; links to Supabase Auth)
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'user',
  plan public.user_plan not null default 'free',
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_role_idx on public.users (role);
create index if not exists users_plan_idx on public.users (plan);

-- Migrate existing profiles → users (if profiles table exists from migration 002)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    insert into public.users (id, email, full_name, role, plan, created_at)
    select
      p.id,
      coalesce(u.email, ''),
      coalesce(p.display_name, ''),
      p.role,
      p.plan,
      p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    on conflict (id) do update set
      full_name = excluded.full_name,
      role = excluded.role,
      plan = excluded.plan;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Signup: create users row (replaces profiles-only trigger)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role, plan)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'user',
    'free'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.users.full_name);

  -- Keep profiles in sync during transition (optional)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    insert into public.profiles (id, role, plan, display_name)
    values (new.id, 'user', 'free', coalesce(new.raw_user_meta_data ->> 'full_name', ''))
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Founder-only & admin feature seeds
-- ---------------------------------------------------------------------------

insert into public.plan_features (plan, feature_key) values
  ('ai_chief_of_staff', 'features.beta'),
  ('ai_chief_of_staff', 'features.experimental')
on conflict (plan, feature_key) do nothing;

insert into public.role_capabilities (role, capability_key) values
  ('admin', 'admin.manage_users'),
  ('admin', 'admin.analytics'),
  ('founder', 'admin.manage_users'),
  ('founder', 'admin.analytics'),
  ('founder', 'features.beta'),
  ('founder', 'features.experimental')
on conflict (role, capability_key) do nothing;

-- ---------------------------------------------------------------------------
-- Analytics placeholders (structure only; no real data pipeline)
-- ---------------------------------------------------------------------------

create table if not exists public.analytics_placeholders (
  id text primary key,
  label text not null,
  description text not null default '',
  admin_only boolean not null default true
);

insert into public.analytics_placeholders (id, label, description) values
  ('active_users', 'Active users', 'Placeholder: count of users active in last 30 days'),
  ('reminders_due', 'Reminders due', 'Placeholder: total reminders due this week'),
  ('plan_distribution', 'Plan distribution', 'Placeholder: breakdown by plan tier'),
  ('upgrade_funnel', 'Upgrade funnel', 'Placeholder: free → premium conversion (not wired)')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers (use users table)
-- ---------------------------------------------------------------------------

create or replace function public.is_founder(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = p_user_id and role = 'founder'
  );
$$;

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = p_user_id and role in ('admin', 'founder')
  );
$$;

create or replace function public.user_has_feature(p_user_id uuid, p_feature text)
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
      from public.users u
      join public.plan_features pf on pf.plan = u.plan
      where u.id = p_user_id and pf.feature_key = p_feature
    )
    or exists (
      select 1
      from public.users u
      join public.role_capabilities rc on rc.role = u.role
      where u.id = p_user_id and rc.capability_key = p_feature
    );
$$;

-- Alias for backwards compatibility
create or replace function public.profile_has_feature(p_user_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_feature(p_user_id, p_feature);
$$;

-- ---------------------------------------------------------------------------
-- RLS: users
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;

drop policy if exists "Users read own row" on public.users;
create policy "Users read own row"
  on public.users for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users update own row" on public.users;
create policy "Users update own row"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins read all users" on public.users;
create policy "Admins read all users"
  on public.users for select
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins update users" on public.users;
create policy "Admins update users"
  on public.users for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

alter table public.plan_features enable row level security;
alter table public.role_capabilities enable row level security;

drop policy if exists "Anyone can read plan features" on public.plan_features;
create policy "Anyone can read plan features"
  on public.plan_features for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read role capabilities" on public.role_capabilities;
create policy "Anyone can read role capabilities"
  on public.role_capabilities for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- RLS: analytics placeholders (admin read only)
-- ---------------------------------------------------------------------------

alter table public.analytics_placeholders enable row level security;

drop policy if exists "Admins read analytics placeholders" on public.analytics_placeholders;
create policy "Admins read analytics placeholders"
  on public.analytics_placeholders for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Optional: link reminders to users (skip if life_admin_items does not exist yet)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'life_admin_items'
  ) then
    alter table public.life_admin_items
      add column if not exists user_id uuid references public.users (id) on delete cascade;

    alter table public.life_admin_items
      drop constraint if exists life_admin_items_user_id_fkey;

    alter table public.life_admin_items
      add constraint life_admin_items_user_id_fkey
      foreign key (user_id) references public.users (id) on delete cascade;

    create index if not exists life_admin_items_user_id_idx
      on public.life_admin_items (user_id);
  end if;
end $$;
