# Redis Failure Behavior

- Normal CRUD must continue where safe.
- Auth and abuse controls may fail closed when documented.
- Log operational failures without secrets.
- Track error rate, latency, evictions, memory, and key cardinality.
- Avoid cascading failures when Redis is slow.
