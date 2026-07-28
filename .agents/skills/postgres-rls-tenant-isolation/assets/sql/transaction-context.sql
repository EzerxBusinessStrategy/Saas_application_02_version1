-- Generic template only. Values must come from trusted server context.
begin;
set local app.user_id = '<trusted-user-uuid>';
set local app.tenant_id = '<trusted-tenant-uuid>';
set local app.membership_id = '<trusted-membership-uuid>';
set local app.is_platform_admin = 'false';
-- tenant-owned queries go here
commit;
