# Transaction Context

Use one checked-out connection for a transaction:

1. Begin the transaction.
2. Set trusted context with `set local`.
3. Execute all tenant-owned queries through that transaction client.
4. Insert audit and outbox rows in the same transaction when required.
5. Commit or roll back.

Never run email, file scanning, report generation, webhook calls, or other slow external work inside the transaction.
