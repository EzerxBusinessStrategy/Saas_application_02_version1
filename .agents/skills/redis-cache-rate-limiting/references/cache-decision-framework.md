# Cache Decision Framework

Use Redis only when measured evidence shows one of:

- repeated expensive reads,
- distributed throttling,
- BullMQ requirement,
- short-lived shared cache,
- distributed coordination.

Do not use Redis when PostgreSQL indexing, query shape, pagination, HTTP caching, or TanStack Query solves the measured issue.
