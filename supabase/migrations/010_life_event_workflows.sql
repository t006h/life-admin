-- Life Admin: life event workflow instances
-- Run after 009_planning_calendar.sql

create table if not exists public.life_admin_life_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  workflow_type text not null check (
    workflow_type in (
      'moving_house',
      'new_job',
      'holiday_planning',
      'starting_university',
      'pregnancy',
      'starting_business'
    )
  ),
  title text not null,
  target_date date,
  status text not null default 'active' check (
    status in ('active', 'completed', 'archived')
  ),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_admin_life_events_type_idx
  on public.life_admin_life_events (workflow_type);

create index if not exists life_admin_life_events_status_idx
  on public.life_admin_life_events (status);

alter table public.life_admin_life_events enable row level security;

drop policy if exists "Allow anon select on life_admin_life_events" on public.life_admin_life_events;
create policy "Allow anon select on life_admin_life_events"
  on public.life_admin_life_events for select to anon using (true);

drop policy if exists "Allow anon insert on life_admin_life_events" on public.life_admin_life_events;
create policy "Allow anon insert on life_admin_life_events"
  on public.life_admin_life_events for insert to anon with check (true);

drop policy if exists "Allow anon update on life_admin_life_events" on public.life_admin_life_events;
create policy "Allow anon update on life_admin_life_events"
  on public.life_admin_life_events for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete on life_admin_life_events" on public.life_admin_life_events;
create policy "Allow anon delete on life_admin_life_events"
  on public.life_admin_life_events for delete to anon using (true);

insert into public.plan_features (plan, feature_key) values
  ('family_premium', 'life.events'),
  ('ai_chief_of_staff', 'life.events')
on conflict (plan, feature_key) do nothing;
