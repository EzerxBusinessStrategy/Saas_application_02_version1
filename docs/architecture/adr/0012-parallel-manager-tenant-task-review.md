# ADR: Parallel Manager and Tenant Admin final task review

Status: Accepted
Date: 2026-08-12
Decision owners: Product owner
Supersedes: 0002-manager-tenant-task-approval-gate

## Context

The earlier two-stage workflow made a submitted task visible to the manager
first and only exposed it to Tenant Admin after manager approval. Product now
requires both authorised reviewers to receive the same submitted task at the
same time and lets either reviewer make the final delivery decision.

## Decision

An employee submission remains in `manager_review`, which is now the shared
pending-review state. It is visible in both the manager review queue and Tenant
Admin task board. Both review surfaces expose the same drag targets:

- Drag to `Done` records a final approval, completes the task, completes the
  employee assignment, makes its billable entry invoice-ready, and notifies the
  Tenant Admin invoice queue.
- Drag to `Returned` requires remarks, restores the task and employee
  assignment to in-progress work, and notifies the employee.

The first authorised manager or Tenant Admin decision locks the task and latest
submitted task submission in the database transaction. It changes their
statuses out of the shared pending-review state, so the task is automatically
removed from the other review queue. Notifications invalidate the other portal
queue in connected sessions.

## Security and consistency

The browser only requests a decision. The backend derives actor, tenant, role,
and manager work-group scope from the authenticated request context. Tenant
Admin decisions require `task.approve`; manager decisions retain their
assigned-work-group review permission. Each final decision records an approval
row and audit event. A concurrent second decision receives a conflict response
and cannot alter the completed or returned task.

## Consequences

- `manager_review` is retained as a database-compatible shared review status;
  no status-schema migration is needed.
- Existing legacy `tenant_approval` tasks remain decidable by Tenant Admin so
  in-flight work is not stranded.
- A manager approval now completes delivery rather than creating a second
  mandatory Tenant Admin gate.
