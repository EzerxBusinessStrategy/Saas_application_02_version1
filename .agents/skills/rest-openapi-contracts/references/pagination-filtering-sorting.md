# Pagination, Filtering And Sorting

- Bound every page size.
- Validate filters server-side.
- Allowlist sort fields.
- Use cursor pagination for large or frequently changing lists.
- Keep filtering, sorting, and pagination inside PostgreSQL.
- Include `nextCursor` only when another page may exist.
- Keep list DTOs compact; avoid returning detail-only nested data.
