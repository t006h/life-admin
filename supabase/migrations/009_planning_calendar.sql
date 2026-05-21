-- Life Admin: calendar time blocks (Planning & Calendar v1)
-- Run after 008_notification_states.sql

create table if not exists public.life_admin_time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  task_id uuid references public.life_admin_tasks (id) on delete set null,
  title text not null,
  block_date date not null,
  start_time time not null,
  end_time time not null,
  category text not null default 'general',
  priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high')
  ),
  source text not null default 'manual' check (
    source in ('manual', 'task_drag', 'ai_plan')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_admin_time_blocks_date_idx
  on public.life_admin_time_blocks (block_date);

create index if not exists life_admin_time_blocks_task_id_idx
  on public.life_admin_time_blocks (task_id);

alter table public.life_admin_time_blocks enable row level security;

drop policy if exists "Allow anon select on life_admin_time_blocks" on public.life_admin_time_blocks;
create policy "Allow anon select on life_admin_time_blocks"
  on public.life_admin_time_blocks for select to anon using (true);

drop policy if exists "Allow anon insert on life_admin_time_blocks" on public.life_admin_time_blocks;
create policy "Allow anon insert on life_admin_time_blocks"
  on public.life_admin_time_blocks for insert to anon with check (true);

drop policy if exists "Allow anon update on life_admin_time_blocks" on public.life_admin_time_blocks;
create policy "Allow anon update on life_admin_time_blocks"
  on public.life_admin_time_blocks for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete on life_admin_time_blocks" on public.life_admin_time_blocks;
create policy "Allow anon delete on life_admin_time_blocks"
  on public.life_admin_time_blocks for delete to anon using (true);

insert into public.plan_features (plan, feature_key) values
  ('family_premium', 'planning.calendar'),
  ('ai_chief_of_staff', 'planning.calendar')
on conflict (plan, feature_key) do nothing;
