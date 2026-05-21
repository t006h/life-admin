-- Life Admin: family members, family reminders, task assignees
-- Run after 004_tasks.sql

create table if not exists public.life_admin_family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  name text not null,
  relationship text not null default '',
  date_of_birth date,
  role text not null default 'parent' check (
    role in ('parent', 'child', 'partner', 'caregiver', 'pet')
  ),
  avatar_color text not null default 'teal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_admin_family_members_user_id_idx
  on public.life_admin_family_members (user_id);

create table if not exists public.life_admin_family_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  member_id uuid references public.life_admin_family_members (id) on delete set null,
  title text not null,
  due_date date not null,
  severity text not null default 'warning' check (
    severity in ('info', 'warning', 'urgent')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_admin_family_reminders_due_date_idx
  on public.life_admin_family_reminders (due_date);

create index if not exists life_admin_family_reminders_member_id_idx
  on public.life_admin_family_reminders (member_id);

alter table public.life_admin_tasks
  add column if not exists assigned_to text not null default 'me' check (
    assigned_to in ('me', 'partner', 'child', 'everyone')
  );

alter table public.life_admin_family_members enable row level security;
alter table public.life_admin_family_reminders enable row level security;

drop policy if exists "Allow anon select on life_admin_family_members" on public.life_admin_family_members;
create policy "Allow anon select on life_admin_family_members"
  on public.life_admin_family_members for select to anon using (true);

drop policy if exists "Allow anon insert on life_admin_family_members" on public.life_admin_family_members;
create policy "Allow anon insert on life_admin_family_members"
  on public.life_admin_family_members for insert to anon with check (true);

drop policy if exists "Allow anon update on life_admin_family_members" on public.life_admin_family_members;
create policy "Allow anon update on life_admin_family_members"
  on public.life_admin_family_members for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete on life_admin_family_members" on public.life_admin_family_members;
create policy "Allow anon delete on life_admin_family_members"
  on public.life_admin_family_members for delete to anon using (true);

drop policy if exists "Allow anon select on life_admin_family_reminders" on public.life_admin_family_reminders;
create policy "Allow anon select on life_admin_family_reminders"
  on public.life_admin_family_reminders for select to anon using (true);

drop policy if exists "Allow anon insert on life_admin_family_reminders" on public.life_admin_family_reminders;
create policy "Allow anon insert on life_admin_family_reminders"
  on public.life_admin_family_reminders for insert to anon with check (true);

drop policy if exists "Allow anon update on life_admin_family_reminders" on public.life_admin_family_reminders;
create policy "Allow anon update on life_admin_family_reminders"
  on public.life_admin_family_reminders for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete on life_admin_family_reminders" on public.life_admin_family_reminders;
create policy "Allow anon delete on life_admin_family_reminders"
  on public.life_admin_family_reminders for delete to anon using (true);

insert into public.plan_features (plan, feature_key) values
  ('family_premium', 'family.management'),
  ('ai_chief_of_staff', 'family.management')
on conflict (plan, feature_key) do nothing;
