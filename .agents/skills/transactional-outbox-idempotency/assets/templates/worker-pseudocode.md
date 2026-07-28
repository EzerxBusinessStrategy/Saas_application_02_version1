# Worker Pseudocode

1. Open short transaction.
2. Claim a bounded batch with `FOR UPDATE SKIP LOCKED`.
3. Commit the claim.
4. For each event, reload authoritative data.
5. Execute idempotent side effect.
6. Mark success or schedule retry.
7. Move exhausted events to failed/dead-letter state.
