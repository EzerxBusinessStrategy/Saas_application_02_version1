# System Module Flow

Status: Phase 2 database foundation implemented
Date: 2026-07-28

This is the source-controlled business process and module-flow diagram for the
approved multi-tenant SaaS architecture. It follows the supplied two-level
architecture pattern, while the accepted ADRs and implemented migrations remain
the technical source of truth.

Legend:

- Solid arrow: required business or data dependency.
- Dashed arrow: optional, asynchronous, conditional, or future dependency.
- Phase 2 implemented: foundational database boundary exists in migrations.
- Planned: approved future scope, not implemented in Phase 2.

```mermaid
flowchart TD
  classDef implemented fill:#e8f5ec,stroke:#1f7a3a,color:#111827,stroke-width:2px
  classDef planned fill:#f3f4f6,stroke:#9ca3af,color:#4b5563,stroke-dasharray: 4 4
  classDef security fill:#eef2ff,stroke:#4338ca,color:#111827,stroke-width:2px
  classDef async fill:#fff7ed,stroke:#c2410c,color:#111827,stroke-dasharray: 6 4

  A1["1. Tenant / Company Setup<br/>Phase 2 implemented foundation"]
  A2["2. Plans, Subscriptions and Branding<br/>APPROVED FUTURE DOMAIN - IMPLEMENTATION DEFERRED"]
  A3["3. Users, Memberships, Roles and Permissions<br/>Phase 2 implemented foundation"]
  A3a["Trusted Database Security Context<br/>Phase 2 implemented"]
  A3b["PostgreSQL RLS Foundation<br/>Phase 2 implemented"]
  A4["4. Employees and Managers<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A5["5. Clients and Client Contacts<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A6["6. Services and Engagements<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A7["7. Work Groups and Assignments<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A8["8. Tasks<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A9["9. Work Logs and Employee Submission<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A10["10. Manager Review<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A11["11. Tenant Admin Final Approval<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A12["12. Client Delivery and Client Visibility<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A13["13. Invoices<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A14["14. Payments and Payment Allocation<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A15["15. Documents and Private File Storage<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A16["16. Support Tickets and Requests<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A17["17. Notifications<br/>PLANNED - NOT IMPLEMENTED IN PHASE 2"]
  A18["18. Audit, Reports and Dashboard<br/>Audit foundation implemented; reports/dashboard planned"]

  A1 --> A2
  A1 --> A3
  A3 --> A3a
  A3a --> A3b
  A3 --> A4
  A1 --> A5
  A5 --> A6
  A6 --> A7
  A4 --> A7
  A7 --> A8
  A8 --> A9
  A9 --> A10
  A10 --> A11
  A11 --> A12
  A5 --> A13
  A6 --> A13
  A13 --> A14
  A15 -. controlled links .-> A5
  A15 -. controlled links .-> A6
  A15 -. controlled links .-> A8
  A15 -. controlled links .-> A13
  A15 -. controlled links .-> A14
  A15 -. controlled links .-> A16
  A16 -. support events .-> A17
  A8 -. domain events .-> A17
  A13 -. billing events .-> A17
  A3 -. sensitive actions .-> A18
  A8 -. sensitive actions .-> A18
  A13 -. sensitive actions .-> A18
  A18 -. derived reporting .-> A5
  A18 -. derived reporting .-> A8
  A18 -. derived reporting .-> A13

  class A1,A3 implemented
  class A3a,A3b security
  class A18 async
  class A2,A4,A5,A6,A7,A8,A9,A10,A11,A12,A13,A14,A15,A16,A17 planned
```

Phase 2 scope guard: this diagram names the complete approved business flow,
but only the highlighted foundation exists in Phase 2 migrations. Business
tables for subscriptions, workforce, clients, engagements, work groups, tasks,
work logs, billing, documents, support, notifications, reports, and dashboards
must wait for their own approved implementation phases.
