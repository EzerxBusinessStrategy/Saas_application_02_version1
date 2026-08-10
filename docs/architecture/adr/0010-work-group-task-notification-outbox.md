# 0010: Work-group task notifications through a transactional outbox

- Status: Accepted
- Date: 2026-08-10
- Decision makers: Product owner and engineering

## Decision

Task creation stores notifications and recipient records with the task in the
same transaction. It also records a unique outbox event for each notification.
A bounded in-process worker claims committed events and emits employee Socket.IO
notifications afterward. Recipient rows remain the durable unread-history source.

## Consequences

Task creation does no per-recipient database writes or network delivery. The
worker can safely retry events because notification and outbox keys are unique.
This is intentionally scoped to task-work-group notifications; it does not
replace existing notification listeners.
