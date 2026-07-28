# Release Sequencing

Sequence production changes as:

1. Backup or confirm recovery point.
2. Apply backward-compatible schema expansion.
3. Deploy compatible application code.
4. Run bounded backfills.
5. Validate data, constraints, RLS, and query plans.
6. Deploy code that depends on the new shape.
7. Remove old shape only in a later approved contraction.

Document the rollback point for each step. Prefer forward-fix after irreversible production changes.
