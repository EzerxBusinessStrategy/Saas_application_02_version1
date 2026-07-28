# Role Permission Matrix Template

| Role | Example permissions | Scope required |
| --- | --- | --- |
| `SUPER_ADMIN` | Platform operations | Platform permission or audited support session |
| `TENANT_OWNER` | Tenant administration | Own tenant |
| `TENANT_ADMIN` | Tenant operations | Own tenant |
| `FINANCE_USER` | Finance reads/writes | Own tenant and finance resources |
| `HR_OPERATIONS_USER` | Workforce reads/writes | Own tenant and HR resources |
| `MANAGER` | Assigned task/work-log actions | Assigned work groups |
| `EMPLOYEE` | Self work actions | Self or assigned records |
| `CLIENT_USER` | Client-visible reads/actions | Own client account |

Replace examples with exact permissions from the approved API contract.
