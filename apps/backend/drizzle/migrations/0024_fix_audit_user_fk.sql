-- Migration 0024: Fix audit events foreign key constraint for platform admins
-- Platform admins may not have a user record in public.users, so we drop the FK constraint
-- on actor_user_id to allow audit events to record auth user IDs without requiring a user row.

alter table audit.audit_events
drop constraint if exists audit_events_actor_user_id_fkey;

-- Add index for query performance since we removed the FK
create index if not exists audit_events_actor_user_id_idx
on audit.audit_events (actor_user_id) where actor_user_id is not null;
