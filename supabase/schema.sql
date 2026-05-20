-- Life Admin — run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.life_admin_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in ('mot', 'passport', 'licence', 'subscriptions', 'bills')
  ),
  title text not null,
  subtitle text not null default '',
  due_date date not null,
  amount numeric,
  frequency text not null default 'monthly',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_admin_items_category_idx
  on public.life_admin_items (category);

create index if not exists life_admin_items_due_date_idx
  on public.life_admin_items (due_date);

alter table public.life_admin_items enable row level security;

-- MVP: allow anon read/write (tighten with auth + user_id when you add login)
create policy "Allow anon select on life_admin_items"
  on public.life_admin_items for select
  to anon
  using (true);

create policy "Allow anon insert on life_admin_items"
  on public.life_admin_items for insert
  to anon
  with check (true);

create policy "Allow anon update on life_admin_items"
  on public.life_admin_items for update
  to anon
  using (true)
  with check (true);

create policy "Allow anon delete on life_admin_items"
  on public.life_admin_items for delete
  to anon
  using (true);
