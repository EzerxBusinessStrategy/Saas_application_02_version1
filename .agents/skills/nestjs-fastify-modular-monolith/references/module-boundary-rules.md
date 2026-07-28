# Module Boundary Rules

- Start from the business domain owner: Platform, Tenancy, Identity, Authorization, Workforce, Clients, Engagements, Work Groups, Tasks, Work Logs, Billing, Documents, Support, Notifications, Professional Progress, Audit, or Reporting.
- Keep controllers, DTOs, services, policies, repositories, and events inside the owning module unless they are genuinely shared infrastructure.
- Let controllers call application services only.
- Let services coordinate policies, repositories, transactions, audit, and outbox events.
- Let repositories own database queries for their module's tables.
- Do not import another module's repository or internal files.
- Use exported application services, explicit ports, or application/domain events for cross-module collaboration.
- Treat circular dependencies as architecture defects. Do not hide them with casual forward references.
- Add abstractions only when they remove real duplication or clarify a stable dependency boundary.
