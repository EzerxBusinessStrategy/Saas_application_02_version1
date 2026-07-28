# Support Access Pattern

Platform support access is exceptional access, not a normal tenant switch.

- Require an explicit reason.
- Require an expiry.
- Record a support access session.
- Surface the session visibly where product requirements demand it.
- Set tenant context only after validating the active support session.
- Write immutable audit events for start, use, and end of access.
- Deny access when the session is expired, revoked, missing, or unrelated to the tenant.
