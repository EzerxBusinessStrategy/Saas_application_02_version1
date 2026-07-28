# RLS Isolation Tests

Test that:

- Tenant A cannot select Tenant B rows.
- Tenant A cannot update Tenant B rows.
- Tenant A cannot delete Tenant B rows.
- Cross-tenant foreign keys fail.
- Runtime role cannot bypass RLS.
- Manager, employee, and client scopes are enforced server-side.
