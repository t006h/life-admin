-- Life Admin: notification center read / snooze / dismiss state
-- Run after 007_family_management.sql

create table if not exists public.life_admin_notification_states (
  notification_key text primary key,
  read_at timestamptz,
  dismissed_at timestamptz,
  snoozed_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists life_admin_notification_states_snoozed_idx
  on public.life_admin_notification_states (snoozed_until);

alter table public.life_admin_notification_states enable row level security;

drop policy if exists "Allow anon select on life_admin_notification_states" on public.life_admin_notification_states;
create policy "Allow anon select on life_admin_notification_states"
  on public.life_admin_notification_states for select to anon using (true);

drop policy if exists "Allow anon insert on life_admin_notification_states" on public.life_admin_notification_states;
create policy "Allow anon insert on life_admin_notification_states"
  on public.life_admin_notification_states for insert to anon with check (true);

drop policy if exists "Allow anon update on life_admin_notification_states" on public.life_admin_notification_states;
create policy "Allow anon update on life_admin_notification_states"
  on public.life_admin_notification_states for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete on life_admin_notification_states" on public.life_admin_notification_states;
create policy "Allow anon delete on life_admin_notification_states"
  on public.life_admin_notification_states for delete to anon using (true);
