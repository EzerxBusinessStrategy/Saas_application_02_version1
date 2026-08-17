-- Allow Tenant Admin documents that are shared with employees without a related client.
-- Existing rows keep their client_id. The composite client FK still rejects cross-tenant values.

alter table public.tenant_documents
  alter column client_id drop not null;
