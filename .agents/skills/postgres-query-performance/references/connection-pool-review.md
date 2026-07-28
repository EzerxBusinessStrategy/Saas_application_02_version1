# Connection Pool Review

- Calculate total connections across API replicas, worker replicas, and migrations.
- Check pool wait time separately from SQL execution time.
- Keep transactions short.
- Do not hold a connection while calling external services.
- Close pools during graceful shutdown.
