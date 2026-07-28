# Resource Naming

- Use plural nouns for collections: `/api/v1/tasks`.
- Use nested routes only when the child cannot be addressed clearly on its own.
- Use action subresources for real workflow transitions: `/api/v1/tasks/{taskId}/submit`.
- Avoid verbs for ordinary CRUD.
- Keep path IDs as lookup inputs only; verify tenant and actor scope server-side.
- Use compact list responses and separate detail endpoints.
