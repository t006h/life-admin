-- Life Admin: Context & Memory Engine v1
-- Run after 011_workflow_engine_types.sql (or after 003_users_architecture.sql)

create table if not exists public.life_admin_context_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  category text not null check (
    category in ('people', 'preferences', 'dates', 'habits')
  ),
  memory_key text not null default '',
  title text not null,
  body text not null default '',
  meta jsonb not null default '{}'::jsonb,
  source text not null default 'user' check (
    source in ('user', 'inferred', 'family_sync')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists life_admin_context_memories_key_idx
  on public.life_admin_context_memories (memory_key)
  where memory_key <> '';

create index if not exists life_admin_context_memories_category_idx
  on public.life_admin_context_memories (category);

alter table public.life_admin_context_memories enable row level security;

drop policy if exists "Allow anon select on life_admin_context_memories" on public.life_admin_context_memories;
create policy "Allow anon select on life_admin_context_memories"
  on public.life_admin_context_memories for select to anon using (true);

drop policy if exists "Allow anon insert on life_admin_context_memories" on public.life_admin_context_memories;
create policy "Allow anon insert on life_admin_context_memories"
  on public.life_admin_context_memories for insert to anon with check (true);

drop policy if exists "Allow anon update on life_admin_context_memories" on public.life_admin_context_memories;
create policy "Allow anon update on life_admin_context_memories"
  on public.life_admin_context_memories for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete on life_admin_context_memories" on public.life_admin_context_memories;
create policy "Allow anon delete on life_admin_context_memories"
  on public.life_admin_context_memories for delete to anon using (true);

insert into public.plan_features (plan, feature_key) values
  ('ai_chief_of_staff', 'context.memory'),
  ('family_premium', 'context.memory')
on conflict (plan, feature_key) do nothing;
