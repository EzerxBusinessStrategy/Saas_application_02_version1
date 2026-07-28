# Authorization Test Matrix

Include positive and negative tests:

| Actor | Allowed case | Denied case |
| --- | --- | --- |
| Tenant Admin | Own tenant client | Other tenant client |
| Finance User | Finance endpoint with permission | HR-only endpoint |
| HR Operations User | Workforce endpoint with permission | Finance-only endpoint |
| Manager | Assigned work-group task | Unassigned work-group task |
| Employee | Own task/work log | Another employee private record |
| Client User | Own client-visible document | Another client document |
| Super Admin support | Active audited support session | Expired or missing support session |

Assert denial behavior does not reveal inaccessible resource existence unless the contract explicitly allows it.
