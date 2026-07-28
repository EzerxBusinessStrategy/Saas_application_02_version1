# Test Checklist

- Same key and same body replays safely.
- Same key and different body is rejected.
- Concurrent duplicates produce one mutation.
- Worker duplicate delivery is safe.
- Retryable failure is retried with backoff.
- Exhausted failure reaches dead-letter state.
