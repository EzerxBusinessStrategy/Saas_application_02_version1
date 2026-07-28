# BullMQ Test Checklist

- Stable job ID deduplicates publication.
- Duplicate delivery is safe.
- Worker crash leaves recoverable job state.
- Redis outage is handled.
- Poison job reaches failed/dead-letter handling.
- Per-tenant fairness is measured where relevant.
