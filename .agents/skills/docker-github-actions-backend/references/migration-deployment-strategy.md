# Migration Deployment Strategy

- Run migrations as a dedicated step or job.
- Preserve rolling-deployment compatibility.
- Use expand-and-contract for breaking changes.
- Validate locks and duration.
- Define rollback or forward-fix.
- Do not run production migrations without explicit authorization.
