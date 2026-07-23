# ADR: Manager review followed by tenant approval for client tasks

Status: Accepted for the frontend mock workflow
Date: 2026-07-23
Decision owners: Product owner

## Context and problem

Employee task submission already requires manager review. The prior mock marked
manager-approved work as done, leaving no Tenant Admin decision point for
client delivery.

## Decision

For the frontend mock, a manager approval moves a task to `review` with
`reviewStatus: approved` and `approvalStatus: pending`. The selected client's
Tenant Admin task view exposes an **Awaiting tenant approval** tab. Only the
Tenant Admin UI can record the final **Approve delivery** or **Return for
rework** decision. Returning work moves it to `rejected`, where the assigned
employee can resume it.

The task drawer is the shared evidence surface: it shows manager-review state,
tenant-approval state, work logs, existing reviewer remarks, attachments,
comments, and delivery history.

## Constraints and production requirements

This is session-local frontend mock behaviour, not backend authorisation. A
production mutation must derive the tenant and actor from the authenticated
session, enforce manager work-group assignment, enforce Tenant Admin scope,
write immutable audit events and decision remarks, and use tenant-safe database
constraints and RLS. The browser must never provide an authority-bearing tenant
ID or actor ID.

## Consequences

- Managers no longer complete a task directly when approving employee work.
- Tenant Admins obtain final delivery control per selected client.
- Employees receive returned work through the existing rejected-to-in-progress
  workflow.
