# Column Change Playbook

Required column:

1. Add nullable column or safe default-compatible column.
2. Deploy compatible application code.
3. Backfill in bounded batches.
4. Validate no nulls remain.
5. Add `NOT NULL`.

Type change:

1. Add new column with target type.
2. Backfill with explicit conversion.
3. Validate conversion.
4. Switch application code.
5. Drop old column later if approved.
