# Drizzle Schema Organisation

Choose one organization and keep it consistent:

- By business module when module ownership is primary.
- By PostgreSQL schema when `public`, `private`, and `audit` separation is primary.

Recommended shape:

```text
src/backend/database/schema/
  public/
  audit/
  private/
```

or:

```text
src/backend/modules/tasks/infrastructure/tasks.schema.ts
```

Do not create a single mega schema file once multiple domains exist.
