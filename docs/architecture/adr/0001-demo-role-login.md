# ADR: Demo role-aware login and route guard

Status: Accepted
Date: 2026-07-23
Decision owners: Product owner

## Context and problem

The frontend currently displays a login form but does not authenticate a user. Each workspace URL independently selects a mock user, so direct navigation can enter another portal.

## Constraints

- This is a frontend demo only; credentials are intentionally hardcoded by product direction.
- All demo portal roles share `abcd1234@gmail.com` and password `1234`, so the role must be explicitly selected at sign-in.
- Production authentication, password storage, tenant isolation, and backend authorisation remain out of scope.

## Considered options

1. Keep the existing form-only login. Rejected because workspace URLs remain unrestricted.
2. Client-side localStorage guard. Rejected because it is not checked before server-rendered routes.
3. Demo HTTP-only cookie plus middleware and layout checks. Accepted for this demo.

## Decision and rationale

Use a minimal demo authentication route that validates the approved hardcoded credentials, sets an HTTP-only session cookie containing the selected role, and redirects users to only that role's workspace. Middleware and the workspace layout deny direct access to a mismatched workspace.

## Positive and negative consequences

- Direct portal URLs are blocked in normal browser use when the signed-in role does not match.
- Shared demo credentials mean the role selector is not a production identity proof.
- Forgot-password remains a non-enumerating mock acknowledgement because the credentials are fixed for this demo.

## Security and operational consequences

This is not production authentication. A production replacement requires an identity provider or backend credential store, password hashing, signed server sessions, password-reset tokens, rate limiting, audit events, tenant-scoped claims, and backend authorisation.

## Migration and rollback

Remove the demo auth routes, cookie, and middleware when a real identity provider is integrated. Restore the existing workspace mock configuration for static demonstration only.

## Validation plan

- Unit-test credential validation and role-to-workspace mapping.
- Component-test shared email login states.
- Browser-test successful role login, rejected credentials, logout, forgot-password acknowledgement, and cross-workspace URL denial.
