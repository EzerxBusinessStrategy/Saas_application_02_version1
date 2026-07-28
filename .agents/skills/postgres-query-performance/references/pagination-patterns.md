# Pagination Patterns

- Use bounded page sizes.
- Use cursor pagination for large or changing feeds.
- Avoid unbounded offset pagination.
- Make cursor fields deterministic and indexed.
- Include a stable tie-breaker such as `id`.
- Keep filters and sorting inside SQL.
