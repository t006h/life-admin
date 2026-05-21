-- Life Admin: tasks + recurring rules (no billing)
-- Run after schema.sql (and user migrations if used)

create table if not exists public.life_admin_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'general',
  priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high')
  ),
  due_date date,
  start_date date,
  estimated_duration_minutes integer,
  tags text[] not null default '{}',
  is_recurring boolean not null default false,
  recurring_rule text check (
    recurring_rule is null
    or recurring_rule in (
      'daily',
      'weekly',
      'biweekly',
      'monthly',
      'every_90_days',
      'first_monday'
    )
  ),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  subtasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_admin_tasks_due_date_idx
  on public.life_admin_tasks (due_date);

create index if not exists life_admin_tasks_priority_idx
  on public.life_admin_tasks (priority);

create index if not exists life_admin_tasks_user_id_idx
  on public.life_admin_tasks (user_id);

alter table public.life_admin_tasks enable row level security;

-- MVP: anon access (tighten with auth + user_id when login is enabled)
drop policy if exists "Allow anon select on life_admin_tasks" on public.life_admin_tasks;
create policy "Allow anon select on life_admin_tasks"
  on public.life_admin_tasks for select to anon using (true);

drop policy if exists "Allow anon insert on life_admin_tasks" on public.life_admin_tasks;
create policy "Allow anon insert on life_admin_tasks"
  on public.life_admin_tasks for insert to anon with check (true);

drop policy if exists "Allow anon update on life_admin_tasks" on public.life_admin_tasks;
create policy "Allow anon update on life_admin_tasks"
  on public.life_admin_tasks for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete on life_admin_tasks" on public.life_admin_tasks;
create policy "Allow anon delete on life_admin_tasks"
  on public.life_admin_tasks for delete to anon using (true);
