-- Product analytics & feedback (production readiness)

create table if not exists public.product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists product_analytics_events_name_idx
  on public.product_analytics_events (event_name, created_at desc);

create index if not exists product_analytics_events_user_idx
  on public.product_analytics_events (user_id, created_at desc);

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  feedback_type text not null check (feedback_type in ('issue', 'feature')),
  message text not null,
  contact_email text,
  created_at timestamptz not null default now()
);

alter table public.product_analytics_events enable row level security;
alter table public.product_feedback enable row level security;

create policy "Users insert own analytics"
  on public.product_analytics_events for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "Users read own analytics"
  on public.product_analytics_events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own feedback"
  on public.product_feedback for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "Users read own feedback"
  on public.product_feedback for select
  to authenticated
  using (auth.uid() = user_id);
