# Migration Review Checklist

- No already-applied migration is edited.
- Production schema is not changed manually.
- Expand-and-contract is used for breaking changes.
- Existing rows are validated before constraints.
- Locks and transaction duration are understood.
- RLS and role implications are documented.
- Empty-database and previous-schema migration tests are planned.
- Rollback or forward-fix strategy is explicit.
- Data deletion has explicit approval and recovery planning.
