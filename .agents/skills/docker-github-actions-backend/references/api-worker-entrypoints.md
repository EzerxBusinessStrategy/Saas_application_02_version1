# API Worker Entrypoints

- Use separate commands for API and worker.
- Share compiled modules when appropriate.
- Keep readiness checks specific to each process.
- Ensure workers handle shutdown signals and stop claiming new work.
- Do not run migrations inside every API replica.
