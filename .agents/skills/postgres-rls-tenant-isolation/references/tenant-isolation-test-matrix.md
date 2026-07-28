# Tenant Isolation Test Matrix

Test with the runtime role:

| Case | Expected result |
| --- | --- |
| Tenant A selects Tenant B rows | Denied or empty |
| Tenant A updates Tenant B rows | Denied |
| Tenant A deletes Tenant B rows | Denied |
| Tenant A inserts child pointing to Tenant B parent | FK failure |
| Manager reads unassigned work group | Denied or empty |
| Employee reads another employee's private work | Denied or empty |
| Client user reads another client account | Denied or empty |
| Runtime role attempts audit mutation | Denied |
| Expired support session reads tenant data | Denied |
| Active support session with audit | Allowed only for scoped tenant |
