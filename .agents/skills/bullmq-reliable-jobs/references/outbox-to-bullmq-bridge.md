# Outbox To BullMQ Bridge

- Commit business mutation and outbox row together.
- Bridge outbox rows to BullMQ after commit.
- Use stable job IDs.
- Mark publication success idempotently.
- Retry publication failures.
- Do not publish queue jobs directly inside business transactions.
