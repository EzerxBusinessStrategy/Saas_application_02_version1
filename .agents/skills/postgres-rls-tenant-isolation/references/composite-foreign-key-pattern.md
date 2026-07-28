# Composite Foreign Key Pattern

Tenant-owned parent tables need a composite unique key:

```sql
unique (tenant_id, id)
```

Tenant-owned child tables must include `tenant_id` and reference parents with the same tenant:

```sql
foreign key (tenant_id, client_id)
references clients (tenant_id, id)
```

Review every child relationship for indirect leaks, including tasks, work logs, invoices, documents, support tickets, access grants, comments, and history tables.
