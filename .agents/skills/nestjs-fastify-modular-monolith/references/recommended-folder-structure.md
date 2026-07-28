# Recommended Folder Structure

Use this as a guide, not mandatory scaffolding:

```text
src/backend/
  main-api.ts
  main-worker.ts
  modules/
    tasks/
      tasks.module.ts
      api/
        tasks.controller.ts
        dto/
      application/
        tasks.service.ts
      domain/
        task.policy.ts
        task.errors.ts
      infrastructure/
        task.repository.ts
        task.repository.port.ts
      tests/
```

Keep technical infrastructure shared only when it is truly generic:

```text
src/backend/shared/
  database/
  auth/
  errors/
  observability/
```

Do not create folders for layers that have no files yet.
