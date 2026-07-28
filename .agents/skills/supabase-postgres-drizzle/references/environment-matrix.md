# Environment Matrix

Document environment variables before using them.

| Environment | Database | Notes |
| --- | --- | --- |
| Development | Local or isolated Supabase development database | Safe for manual experiments |
| Test | Disposable PostgreSQL database | Run migrations and integration tests |
| Staging | Production-like isolated database | Validate migrations before production |
| Production | Supabase-managed PostgreSQL | No manual schema mutation |

Do not invent variable names silently. Add documentation for every new required variable and keep secret values out of source.
