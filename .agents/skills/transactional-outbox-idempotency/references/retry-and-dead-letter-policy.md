# Retry And Dead Letter Policy

- Use bounded exponential backoff with jitter.
- Distinguish retryable and permanent errors.
- Move poison events to a failed or dead-letter state.
- Preserve enough error metadata for diagnosis without leaking secrets.
- Define manual recovery and replay rules.
- Define retention and cleanup.
