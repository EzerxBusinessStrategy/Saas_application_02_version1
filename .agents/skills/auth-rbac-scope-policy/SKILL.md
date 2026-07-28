---
name: auth-rbac-scope-policy
description: Use when Codex designs, implements, or reviews authentication boundaries, Supabase Auth integration, tenant memberships, RBAC roles, permissions, resource-level scope policies, support access, authorization guards, RLS defense, or authorization test matrices for this multi-role SaaS. Do not use for frontend visibility alone, CSS work, generic login UI, or unrelated identity-provider questions.
---

# Auth RBAC Scope Policy

Use this skill for backend authorization design and implementation. Do not modify authentication code during skill creation.

## Role Model

Support these roles:

- `SUPER_ADMIN`
- `TENANT_OWNER`
- `TENANT_ADMIN`
- `FINANCE_USER`
- `HR_OPERATIONS_USER`
- `MANAGER`
- `EMPLOYEE`
- `CLIENT_USER`

## Layer Model

- Authentication: who is the user?
- Tenant membership: which tenant relationship is active?
- RBAC: which action types may the role perform?
- Scope policy: which specific resources may the actor access?
- RLS: which database rows may the database session access?

## Workflow

1. Identify actor type.
2. Resolve trusted context server-side.
3. Identify the action.
4. Identify the target resource.
5. Evaluate global/platform permission.
6. Evaluate tenant membership.
7. Evaluate resource scope.
8. Rely on RLS as database defense in depth.
9. Audit sensitive decisions.
10. Add denial-path tests.

## Rules

- Use Supabase Auth to verify identity.
- Resolve users, memberships, roles, and permissions in the backend.
- Never let the browser choose trusted tenant, actor, role, or scope.
- Treat frontend visibility as UX only.
- Enforce authorization with backend guards and policies.
- Use PostgreSQL RLS as defense in depth.
- Restrict managers to assigned work groups only.
- Restrict employees to assigned or self-owned records only.
- Restrict client users to their own client account only.
- Require finance permission for finance data.
- Require HR permission for HR data.
- Make Super Admin support access reasoned, expiring, and audited.
- Define suspended tenant and suspended user behavior explicitly.
- Avoid permission-denied responses that leak resource existence.
- Test authorization with positive and negative matrices.
- Audit sensitive permission changes.
- Invalidate permission caches safely.

## References

- `references/authorization-layer-model.md`
- `references/role-permission-matrix-template.md`
- `references/resource-scope-policy-pattern.md`
- `references/nestjs-guard-pattern.md`
- `references/support-access-session.md`
- `references/authorization-test-matrix.md`

## Assets

- `assets/policy-decision-template.md`

## Trigger Tests

Should activate:

- "Design backend guards and policies for manager task approval."
- "Create an authorization test matrix for Client User document access."
- "Review whether Tenant Admin and Finance User permissions are separated correctly."

Should not activate:

- "Make the login form look better."
- "Hide a sidebar link for employees only."
- "Explain OAuth at a high level without this SaaS scope model."
