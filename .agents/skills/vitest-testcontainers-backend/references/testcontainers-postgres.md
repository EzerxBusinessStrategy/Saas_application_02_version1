# Testcontainers PostgreSQL

- Use disposable PostgreSQL for database behavior.
- Run real migrations before tests.
- Create the table-owner and runtime roles used by the app.
- Connect RLS tests with the runtime role.
- Seed deterministic Tenant A and Tenant B data.
- Stop containers and close connections in teardown.
