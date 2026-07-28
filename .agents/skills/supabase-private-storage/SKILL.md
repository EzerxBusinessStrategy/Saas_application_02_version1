---
name: supabase-private-storage
description: Design and implement secure private-document workflows using Supabase Storage, PostgreSQL metadata, signed URLs, access grants, versioning, audit events, and asynchronous malware scanning. Use when working on protected file upload/download flows, private buckets, storage metadata, document grants, signed URL security, quarantine, retention, or cross-tenant document isolation. Do not use for public static assets or creating buckets during skill creation.
---

# Supabase Private Storage

## Workflow

1. Read `AGENTS.md`, storage ADRs, security architecture, and document API contracts.
2. Make an authorization decision from trusted tenant and actor context.
3. Create or update PostgreSQL metadata before upload where required.
4. Issue short-lived signed upload URLs only after authorization.
5. Confirm uploaded object metadata server-side.
6. Validate extension, declared MIME type, magic bytes, file size, and category.
7. Scan files asynchronously and keep files pending or quarantined until clean.
8. Evaluate access grants before signed download.
9. Audit uploads, downloads, permission changes, deletions, scanning results, and retention actions.
10. Do not create buckets or connect to Supabase during skill-creation tasks.

## Rules

- Use private buckets only for protected documents.
- Never send the Supabase service-role key to the browser.
- Use non-guessable tenant-scoped object keys.
- Store file bytes in object storage and metadata in PostgreSQL.
- Use short-lived signed upload and download URLs.
- Do not expose permanent public URLs.
- Support immutable versions; do not overwrite history.
- Use access grants instead of duplicating physical files.
- Prevent cross-tenant object-key and metadata access.

## References

- `references/storage-architecture.md`
- `references/signed-upload-flow.md`
- `references/signed-download-flow.md`
- `references/file-validation.md`
- `references/malware-scan-and-quarantine.md`
- `references/document-access-grants.md`
- `references/retention-and-audit.md`

## Trigger Tests

Should activate:

- "Design signed upload for tenant documents."
- "Review whether clients can download only their own files."
- "Add a malware-scan quarantine flow."

Should not activate:

- "Optimize a public logo image."
- "Style the document card UI."
- "Create a Supabase bucket now."
