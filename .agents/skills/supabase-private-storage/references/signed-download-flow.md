# Signed Download Flow

1. Authenticate actor.
2. Load document metadata by resource ID.
3. Evaluate tenant, role, and access grants.
4. Deny without leaking inaccessible existence where needed.
5. Issue short-lived signed download URL.
6. Audit the access.
