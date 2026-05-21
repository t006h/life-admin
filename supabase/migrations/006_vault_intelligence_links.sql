-- Vault intelligence: link documents ↔ reminders
-- Run after 005_vault_documents.sql

alter table public.life_admin_vault_documents
  add column if not exists linked_reminder_id uuid;

alter table public.life_admin_items
  add column if not exists vault_document_id uuid;

create index if not exists life_admin_items_vault_doc_idx
  on public.life_admin_items (vault_document_id);
