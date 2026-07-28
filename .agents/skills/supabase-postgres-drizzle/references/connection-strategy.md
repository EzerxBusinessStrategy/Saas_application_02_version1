# Connection Strategy

- Use node-postgres pools underneath Drizzle.
- Create bounded pools for API and worker runtimes.
- Calculate total possible connections: pool size times API replicas plus pool size times worker replicas plus migration/admin connections.
- Keep production credentials server-only.
- Validate required environment variables at startup.
- Close pools during graceful shutdown.
- Keep read/write behavior explicit; do not hide production access behind local defaults.
