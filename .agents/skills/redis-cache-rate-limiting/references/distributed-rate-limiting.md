# Distributed Rate Limiting

Use separate policies for:

- login,
- password reset,
- uploads,
- exports,
- document URLs,
- normal authenticated APIs.

Choose IP, user, tenant, or combined scopes based on abuse path. Return `429` with retry information.
