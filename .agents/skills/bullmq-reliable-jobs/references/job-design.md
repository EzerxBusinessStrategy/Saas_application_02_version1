# Job Design

- Name queues by owning domain.
- Use payload identifiers, not large snapshots.
- Include tenant ID when the job is tenant-scoped.
- Reload authoritative state in the processor.
- Treat already-completed work as safe no-op where appropriate.
