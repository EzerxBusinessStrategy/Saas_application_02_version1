# NestJS Database Module

- Provide the node-postgres pool as a singleton.
- Provide Drizzle from the same pool.
- Export only stable database services needed by repositories.
- Keep repositories in owning modules.
- Avoid global helpers that bypass policies, transactions, or tenant context.
- Provide a transaction helper when multiple repositories must share one checked-out connection.
