# Architecture conventions

Use a modular monolith first: presentation → application → domain → infrastructure. Keep modules cohesive and prohibit circular imports, cross-module repository access, controllers with business logic, and infrastructure types in domain contracts. Backend modules own lifecycle, validation, permissions, APIs, events, repositories, and audit records for Tenants, Users, Auth, Authorisation, Organisation, Employees, Clients, Engagements, Work Groups, Tasks, Work Logs, Approvals, Billing, Documents, Notifications, Reports, Audit Logs, and Branding.

Frontend uses App Router and Server Components by default; use client components only for interaction. Keep domain logic in feature folders, runtime validation in Zod, server data in Server Components/TanStack Query, and temporary UI state in Zustand. Reusable primitives do not fetch APIs. Every state has loading, empty, error, permission, and tenant-theme behavior.

Major boundary, isolation, auth, API, queue, cache, billing, audit, or infrastructure changes require options, trade-offs, security/performance/operational/migration/cost impacts, approval, and an ADR.
