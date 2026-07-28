# Index Design

- Lead tenant-scoped indexes with `tenant_id` when queries are tenant-bound.
- Put equality predicates before range predicates.
- Align trailing columns with `ORDER BY` when useful.
- Avoid speculative indexes.
- Account for insert/update/delete cost.
- Prefer partial indexes only when the predicate is stable and common.
- Validate with the real query shape after adding an index.
