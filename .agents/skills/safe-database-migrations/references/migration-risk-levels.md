# Migration Risk Levels

- Low: additive nullable column, new table with no production traffic, non-unique index on small table.
- Medium: new foreign key, new unique constraint, backfill, RLS policy change, larger index.
- High: type conversion, `NOT NULL` on existing data, table rewrite, permission/role change, large backfill.
- Critical: destructive data change, production role ownership change, tenant isolation change, irreversible operation.

Escalate high and critical changes for explicit approval and rollback planning.
