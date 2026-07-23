# Secure Documents and Invoices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixture-only documents and invoices with a backend-authorised, tenant-safe private-file workflow reflected across Tenant Admin, Manager, Employee, and Client portals.

**Architecture:** Keep `src/features/operations` as the typed frontend boundary. A backend-owned Documents/Billing service stores metadata and access records; private object storage stores one physical object per document or invoice. The frontend receives only authorised metadata and short-lived signed URLs on explicit preview/download requests.

**Tech Stack:** Next.js App Router, TypeScript, Zod, TanStack Query, existing shadcn/ui primitives, private object storage selected by the product owner.

> **Frontend-only scope approved 2026-07-23:** Task 5 may use typed,
> browser-persisted **metadata only** to demonstrate the role-aware interface.
> It must never retain file bytes or claim a security boundary. Tasks 1–4 and
> production security verification remain deferred until a backend owner and
> private storage provider are approved.

## Global Constraints

- Do not implement durable file upload without the approved ADR and backend owner.
- Derive tenant, actor, client, manager, work-group, and recipient scope server-side.
- Use private storage, non-guessable tenant-scoped object keys, signed URLs, MIME/extension/size validation, malware scanning, audit events, idempotent mutations, composite tenant-safe foreign keys, RLS, and tenant-leading indexes.
- Do not use browser memory, local storage, public URLs, or client-supplied tenant IDs as a security boundary.
- Reuse `PageHeader`, `DataTable`, `FilterToolbar`, `StatusBadge`, `EmptyState`, `ErrorState`, `LoadingState`, `Dialog`, and existing role-aware route handling.

---

### Task 1: Approve the service boundary and production dependencies

**Files:**
- Approve: `docs/architecture/adr/0003-secure-document-and-invoice-storage.md`
- Modify: `docs/api/provisional-contracts.md`

- [ ] Confirm the storage provider, backend module owner, scan policy, retention policy, and API deployment location.
- [ ] Mark ADR 0003 Accepted only after product and backend approval.
- [ ] Document the chosen provider and retention policy in `docs/api/provisional-contracts.md`.

### Task 2: Add tenant-safe backend data model and access service

**Files:**
- Create: backend Documents module migrations, repositories, service, controller, and tests in the approved backend repository.

**Interfaces:**
- Produces `DocumentAccessService` and `InvoiceAccessService` checks for view, download, upload, metadata edit, access management, archive, delete, and payment-status updates.

- [ ] Create `documents`, `document_access`, `document_activity`, `invoices`, `invoice_access`, and `invoice_activity` tables with tenant IDs, composite tenant foreign keys, tenant-leading indexes, and forced RLS.
- [ ] Implement server-derived recipient validation for Tenant Admin, Manager, Employee, and Client uploader rules.
- [ ] Implement immutable audit records and idempotent mutations.
- [ ] Add Tenant A/B isolation tests and cross-client/client-user denial tests.

### Task 3: Add secure storage sessions and authorised file retrieval

**Files:**
- Create: backend private-storage adapter and upload/download endpoints in the approved backend repository.

**Interfaces:**
- `POST /documents/upload-sessions`
- `POST /documents`
- `GET /documents/:id/download-url`
- `POST /invoices/upload-sessions`
- `POST /invoices`
- `GET /invoices/:id/download-url`

- [ ] Validate allowlisted MIME type, extension, content length, random storage key, tenant path, and file scan result before persistence.
- [ ] Create short-lived signed upload/download URLs only after `DocumentAccessService` or `InvoiceAccessService` authorises the actor.
- [ ] Add failure cleanup so an object without a committed metadata record is deleted or quarantined.

### Task 4: Replace fixture contracts with typed server contracts

**Files:**
- Modify: `src/types/operations.ts`
- Modify: `src/features/operations/api/operations-api.ts`
- Modify: `src/features/operations/api/operations-api.test.ts`

**Interfaces:**
- Consumes the endpoints from Task 3.
- Produces paginated `listDocuments`, `createDocumentUploadSession`, `createDocument`, `listInvoices`, `createInvoiceUploadSession`, `createInvoice`, and authorised preview/download mutations.

- [ ] Replace fixture-only document/invoice reads with Zod-validated API responses while retaining no backend fallback as an explicit error state.
- [ ] Keep the frontend payload free of trusted tenant or actor IDs.
- [ ] Add contract tests for role-scoped lists, visibility, and error responses.

### Task 5: Build the existing-design-system document and invoice workspaces

**Files:**
- Modify: `src/components/operations/finance-documents.tsx`
- Modify: `src/app/(app)/[workspace]/[section]/page.tsx`
- Modify: `src/lib/route-access.ts`
- Modify: `src/lib/permissions.ts`

- [ ] Extend the existing workspace rather than introduce a parallel document system.
- [ ] Provide role-aware upload, list, filter, details, access, activity, preview/download, loading, empty, filtered-empty, error, and permission-denied states.
- [ ] Restrict recipient selectors to server-provided eligible recipients; Clients receive no selector and Employees only receive Manager/Tenant Admin options.
- [ ] Use mobile cards rather than forcing the table onto narrow screens.

### Task 6: Verify the end-to-end security and UI workflow

**Files:**
- Modify/Create: frontend component tests and backend integration/isolation tests in the approved backend repository.

- [ ] Test all requested document sharing combinations, role restrictions, portal reflection, access changes, audit events, upload validation/failure, and cross-tenant/cross-client denial.
- [ ] Test client-visible and internal invoices, payment-status authority, preview/download authority, and invoice audit activity.
- [ ] Run formatting, linting, type-checking, unit tests, integration tests, Tenant A/B isolation tests, production build, and browser verification at 1440, 1280, 1024, 768, 430, and 375px.

## Blocked execution boundary

This frontend repository has no selected storage provider, backend module, schema, or secure API. Do not substitute browser-held files or fake upload persistence for Tasks 2–4.
