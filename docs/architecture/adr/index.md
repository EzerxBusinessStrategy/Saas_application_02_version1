# ADR index

- [0001: Demo role-aware login and route guard](0001-demo-role-login.md)
- [0002: Manager review followed by tenant approval for client tasks](0002-manager-tenant-task-approval-gate.md)
- [0003: Secure document and invoice storage and access service](0003-secure-document-and-invoice-storage.md) (Accepted for frontend mock UI only)
- [0004: PostgreSQL database architecture](0004-postgresql-database-architecture.md) (Accepted)
- [0005: Database-backed platform configuration](0005-database-backed-platform-configuration.md) (Accepted)
- [0006: Direct Tenant Administrator provisioning](0006-direct-tenant-admin-provisioning.md) (Accepted)
- [0007: Tenant timed suspension and soft revocation](0007-tenant-timed-suspension-and-soft-revocation.md) (Accepted)
- [0008: Country-scoped tenant financial years](0008-country-scoped-tenant-financial-years.md) (Accepted)
- [0009: Request-path performance and authenticated-context caching](0009-request-path-performance.md) (Accepted)
- [0010: Work-group task notification outbox](0010-work-group-task-notification-outbox.md) (Accepted)
- [0011: User-owned localization and time-zone preferences](0011-user-localization-preferences.md) (Proposed)
- [0012: Parallel Manager and Tenant Admin final task review](0012-parallel-manager-tenant-task-review.md) (Accepted)
- [0013: Portal-Specific Authentication](0013-portal-specific-authentication.md) (Accepted)

Supporting proposed architecture documents:

- [Phase 0 architecture decision lock](../phase-0-architecture-decision-lock.md)
- [Subscription architecture](../subscription-architecture.md)

ADR 0004 was explicitly approved for implementation on 2026-07-28. The
supporting documents authorize only the approved phase scope; they do not
authorize database migrations, Supabase resource creation, production
infrastructure changes, or deployment by themselves.
