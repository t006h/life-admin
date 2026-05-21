-- Workflow Engine v1 — life_admin_life_events (create if missing + expanded types)
-- Safe to run even if you skipped 010_life_event_workflows.sql
-- Run after 009_planning_calendar.sql (or any time after 003_users_architecture.sql)

create table if not exists public.life_admin_life_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  workflow_type text not null,
  title text not null,
  target_date date,
  status text not null default 'active' check (
    status in ('active', 'completed', 'archived')
  ),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.life_admin_life_events
  drop constraint if exists life_admin_life_events_workflow_type_check;

alter table public.life_admin_life_events
  add constraint life_admin_life_events_workflow_type_check check (
    workflow_type in (
      'moving_house',
      'new_job',
      'holiday_planning',
      'starting_university',
      'pregnancy',
      'starting_business',
      'passport_renewal',
      'buy_car',
      'school_trip',
      'dentist_appointment',
      'mot_renewal',
      'insurance_renewal',
      'generic'
    )
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
