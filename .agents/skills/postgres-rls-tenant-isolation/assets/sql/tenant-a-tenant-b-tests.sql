-- Generic test sketch only. Run only against disposable test databases.
set role app_runtime;
begin;
set local app.tenant_id = '<tenant-a>';
select count(*) from example_records where tenant_id = '<tenant-b>';
rollback;
