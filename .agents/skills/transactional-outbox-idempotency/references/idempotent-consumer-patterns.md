# Idempotent Consumer Patterns

- Use natural uniqueness for external effects where possible.
- Store provider delivery IDs and processed event IDs.
- Reload authoritative business state before acting.
- Treat missing or already-completed work as a successful no-op when safe.
- Keep payloads as identifiers, not sensitive snapshots.
