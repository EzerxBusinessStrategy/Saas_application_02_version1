# Outbox Schema

Keep the outbox append-oriented.

Minimum fields:

- `id`
- `tenant_id` when tenant-owned
- `event_type`
- `aggregate_type`
- `aggregate_id`
- `payload`
- `status`
- `available_at`
- `attempts`
- `created_at`
- `locked_at`
- `locked_by`
- `last_error`

Commit the outbox row in the same transaction as the business mutation.
