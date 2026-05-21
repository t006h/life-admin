-- Life Admin: family document vault (metadata + storage path placeholders)
-- Run after 004_tasks.sql
--
-- Storage (create in Dashboard → Storage when ready):
--   Bucket: vault-documents (private)
--   Example path: vault-documents/{document_id}/{filename}

create table if not exists public.life_admin_vault_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'other' check (
    category in (
      'passport',
      'insurance',
      'school',
      'receipts',
      'warranties',
      'property',
      'other'
    )
  ),
  expiry_date date,
  reminder_status text not null default 'none' check (
    reminder_status in ('none', 'scheduled', 'alert', 'expired')
  ),
  storage_path text,
  source text not null default 'manual' check (
    source in ('upload', 'scan', 'manual')
  ),
  extracted_data jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_admin_vault_documents_category_idx
  on public.life_admin_vault_documents (category);

create index if not exists life_admin_vault_documents_expiry_idx
  on public.life_admin_vault_documents (expiry_date);

alter table public.life_admin_vault_documents enable row level security;

drop policy if exists "Allow anon select on life_admin_vault_documents"
  on public.life_admin_vault_documents;
create policy "Allow anon select on life_admin_vault_documents"
  on public.life_admin_vault_documents for select to anon using (true);

drop policy if exists "Allow anon insert on life_admin_vault_documents"
  on public.life_admin_vault_documents;
create policy "Allow anon insert on life_admin_vault_documents"
  on public.life_admin_vault_documents for insert to anon with check (true);

drop policy if exists "Allow anon update on life_admin_vault_documents"
  on public.life_admin_vault_documents;
create policy "Allow anon update on life_admin_vault_documents"
  on public.life_admin_vault_documents for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete on life_admin_vault_documents"
  on public.life_admin_vault_documents;
create policy "Allow anon delete on life_admin_vault_documents"
  on public.life_admin_vault_documents for delete to anon using (true);
