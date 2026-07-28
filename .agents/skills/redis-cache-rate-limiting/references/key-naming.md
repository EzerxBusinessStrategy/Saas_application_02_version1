# Key Naming

Use versioned, tenant-aware keys:

```text
v1:tenant:{tenantId}:resource:{resourceId}:view:{viewName}
```

- Include tenant scope for tenant data.
- Include schema/version segment.
- Keep cardinality bounded.
- Avoid secrets and raw tokens in keys.
