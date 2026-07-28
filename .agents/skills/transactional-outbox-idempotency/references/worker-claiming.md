# Worker Claiming

- Claim bounded batches.
- Use `FOR UPDATE SKIP LOCKED` or an approved equivalent.
- Mark claimed rows with worker identity and timestamp.
- Process outside the claim transaction when the external action may be slow.
- Make completion and retry updates idempotent.
- Release or safely complete claims on graceful shutdown.
