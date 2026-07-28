# Stampede Prevention

- Add TTL jitter.
- Use single-flight locks for hot keys.
- Consider stale-while-revalidate for read-heavy non-authoritative data.
- Keep lock TTL short and bounded.
- Fall back safely if lock acquisition fails.
