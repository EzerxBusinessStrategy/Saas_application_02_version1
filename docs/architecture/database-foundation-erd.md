# Database Foundation ERD

Status: Phase 2 database foundation implemented
Date: 2026-07-28

This is the editable source for the Phase 2 database relationship diagram. It
matches the implemented migration objects only.

Supabase Auth is external to the application database. It owns credentials,
password handling, provider identities, refresh tokens, MFA, password recovery,
and session mechanics. The application database stores only the verified
Supabase Auth user ID mapping on `public.users`.

```mermaid
erDiagram
  SUPABASE_AUTH_USERS ||..|| USERS : "external verified identity"
  TENANTS ||--o{ TENANT_MEMBERSHIPS : "tenant_id"
  USERS ||--o{ TENANT_MEMBERSHIPS : "user_id"
  TENANT_MEMBERSHIPS ||--o{ MEMBERSHIP_ROLES : "tenant-safe (tenant_id, membership_id)"
  ROLES ||--o{ MEMBERSHIP_ROLES : "role_id"
  ROLES ||--o{ ROLE_PERMISSIONS : "role_id"
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : "permission_id"
  TENANTS ||--o{ AUDIT_EVENTS : "nullable tenant_id"
  USERS ||--o{ AUDIT_EVENTS : "actor_user_id"
  TENANT_MEMBERSHIPS ||--o{ AUDIT_EVENTS : "tenant-safe actor membership"

  SUPABASE_AUTH_USERS {
    uuid id PK
    string credentials "external - not stored in app DB"
  }

  TENANTS {
    string schema "public"
    uuid id PK
    string tenant_ownership "tenant boundary root"
    text code UK
    text legal_name
    text display_name
    text status "CHECK provisioning, active, suspended, archived"
    text country
    text currency
    text timezone
    timestamptz suspended_at
    string rls "ENABLED and FORCED"
    string runtime_dml "denied in Phase 2"
    string lifecycle "Phase 2 implemented"
  }

  USERS {
    string schema "public"
    uuid id PK
    string tenant_ownership "global application identity"
    uuid supabase_auth_user_id UK
    text email "not immutable identity key"
    text email_normalized UK
    text display_name
    text status "CHECK active, suspended, deactivated, anonymized"
    string rls "ENABLED and FORCED"
    string runtime_dml "denied in Phase 2"
    string lifecycle "Phase 2 implemented"
  }

  TENANT_MEMBERSHIPS {
    string schema "public"
    uuid id PK
    uuid tenant_id FK
    uuid user_id FK
    text status "CHECK invited, active, suspended, removed"
    text display_name
    text timezone
    string unique_1 "UNIQUE tenant_id, id"
    string unique_2 "UNIQUE tenant_id, user_id"
    string rls "ENABLED and FORCED"
    string runtime_dml "denied in Phase 2"
    string lifecycle "Phase 2 implemented"
  }

  ROLES {
    string schema "public"
    uuid id PK
    string tenant_ownership "global platform catalogue"
    text code UK
    text name
    text scope "CHECK platform, tenant"
    boolean system_role
    string rls "not tenant-owned; runtime SELECT only"
    string lifecycle "Phase 2 implemented"
  }

  PERMISSIONS {
    string schema "public"
    uuid id PK
    string tenant_ownership "global platform catalogue"
    text code UK
    text description
    text resource
    text action
    string rls "not tenant-owned; runtime SELECT only"
    string lifecycle "Phase 2 implemented"
  }

  ROLE_PERMISSIONS {
    string schema "public"
    uuid role_id PK,FK
    uuid permission_id PK,FK
    string tenant_ownership "global platform catalogue join"
    string unique_1 "PRIMARY KEY role_id, permission_id"
    string rls "not tenant-owned; runtime SELECT only"
    string lifecycle "Phase 2 implemented"
  }

  MEMBERSHIP_ROLES {
    string schema "public"
    uuid id PK
    uuid tenant_id FK
    uuid membership_id FK
    uuid role_id FK
    uuid assigned_by_membership_id FK
    timestamptz assigned_at
    string unique_1 "UNIQUE tenant_id, id"
    string unique_2 "UNIQUE tenant_id, membership_id, role_id"
    string tenant_safe_fk "FOREIGN KEY tenant_id, membership_id"
    string rls "ENABLED and FORCED"
    string runtime_dml "denied in Phase 2"
    string lifecycle "Phase 2 implemented"
  }

  AUDIT_EVENTS {
    string schema "audit"
    uuid id PK
    uuid tenant_id FK "nullable for platform events"
    uuid actor_user_id FK
    uuid actor_membership_id FK
    uuid support_access_session_id
    text action
    text resource_type
    uuid resource_id
    text result "CHECK succeeded, denied, failed"
    text reason
    text request_id
    jsonb metadata
    timestamptz created_at
    string write_path "audit.write_audit_event only for runtime"
    string rls "ENABLED and FORCED"
    string lifecycle "Phase 2 implemented"
  }
```

Trusted helper functions live under `private` and are not normal tables:

- `private.current_tenant_id()`
- `private.current_user_id()`
- `private.current_membership_id()`
- `private.current_support_access_session_id()`
- `private.current_request_id()`
- `private.is_platform_admin()`
- `private.has_tenant_context(uuid)`
- `private.has_support_tenant_context(uuid)`
- `audit.write_audit_event(...)`

Implemented relationship rules:

- `tenant_memberships` uses `UNIQUE (tenant_id, id)` and `UNIQUE (tenant_id, user_id)`.
- `membership_roles` uses composite tenant-safe foreign keys to memberships.
- Runtime DML on tenants, users, tenant memberships, and membership-role
  assignments is denied in Phase 2. Future write paths need explicit service
  authorization and/or reviewed security-definer functions.
- `audit.audit_events` stores nullable tenant scope only for platform-valid events.
- No password, password hash, password salt, refresh token, or duplicate session
  column exists in the application data model.
- Future tenant-owned tables must include `tenant_id` and composite foreign keys
  to tenant-owned parents; they are not created in Phase 2.
