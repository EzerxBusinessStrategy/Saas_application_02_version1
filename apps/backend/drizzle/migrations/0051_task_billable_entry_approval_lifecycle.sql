-- Keep task charges pending until the Tenant Admin records final delivery approval.
-- Existing schema already has all required task, approval, and billing columns.

insert into public.permissions (code, description, resource, action)
values ('task.approve', 'Record final Tenant Admin task approval.', 'task', 'approve')
on conflict (code) do update
set description = excluded.description,
    resource = excluded.resource,
    action = excluded.action;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'task.approve'
where r.code in ('TENANT_OWNER', 'TENANT_ADMIN')
on conflict do nothing;

-- Earlier application code marked a task charge invoice-ready at task creation.
-- Retain completed-task charges, but return unfinished work to pending review.
update public.billable_task_entries bte
set status = 'pending_review',
    approved_by = null,
    approved_at = null,
    updated_at = now()
from public.tasks t
where t.tenant_id = bte.tenant_id
  and t.id = bte.task_id
  and bte.status = 'approved_for_invoice'
  and t.status <> 'completed';
