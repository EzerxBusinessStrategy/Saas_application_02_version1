# ADR 0014: Portal Private Document Buckets

## Status

Accepted 2026-08-14 by product owner request.

## Context

Documents, agreements, and uploaded invoice files are business records that
may be shared between the Tenant, Employee, Manager, and Client portals. The
existing implementation used one private `tenant-documents` bucket and
authorised access through PostgreSQL metadata.

## Decision

Use five fixed, private Supabase Storage buckets:

- `super-admin-documents`
- `tenant-documents`
- `manager-documents`
- `employee-documents`
- `client-documents`

The authenticated server selects the upload bucket. The browser never chooses
the bucket or object key. Each object key includes the trusted tenant UUID,
client UUID, originating portal, and a UUID operation identifier.

A shared file remains a single physical object in its originating bucket.
Recipient access is authorised through tenant-scoped PostgreSQL metadata and
the backend issues a short-lived signed download URL from that source bucket.
No object is copied into another portal bucket merely to share it. This avoids
duplicate files, inconsistent versions, and cross-tenant collisions.

## Consequences

- `tenant_documents.storage_bucket` is the authoritative source bucket for a
  stored object.
- Tenant Admin document, agreement, and invoice uploads use
  `tenant-documents`; employee uploads use `employee-documents`; an employee
  acting as a Manager uses `manager-documents`.
- The Super Admin and Client buckets are provisioned for their portal upload
  endpoints. No inactive portal can access an object without a backend
  authorisation decision.
- Existing objects in `tenant-documents` remain valid and require no copy or
  backfill.
- Portal sharing remains tenant scoped: client visibility is tied to the
  authenticated client account, while employee and manager visibility uses
  recipient membership grants.

## Security and tenancy

- Buckets are private and have a 20 MB limit with an allowlisted MIME set.
- The backend service role is used only server side for signed upload and
  download URLs.
- Object keys are tenant scoped and non-guessable; object metadata access is
  authorised by the backend with trusted request context and PostgreSQL RLS.
- Upload metadata creation is idempotent per tenant, actor, and operation key.

