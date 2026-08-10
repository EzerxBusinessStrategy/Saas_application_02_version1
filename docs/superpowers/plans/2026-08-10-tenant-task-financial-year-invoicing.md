# Tenant Task Financial-Year Invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create tenant tasks against the Super Admin configured country financial year, preserve their billable charge at creation, and allow invoicing only after the Tenant Admin final approval.

**Architecture:** The existing `financial_year_templates -> tenant_financial_years -> tasks.financial_year_id -> invoices.financial_year_id` model remains the source of truth. The browser selects only a country option supplied by the authenticated tenant API; the backend resolves and verifies the active tenant financial year. A final Tenant Admin task decision promotes the existing billable entry to `approved_for_invoice` in the same transaction as task completion.

**Tech Stack:** Next.js App Router, React, TanStack Query, NestJS, PostgreSQL, node-postgres, Zod, Supabase Auth/RLS.

## Global Constraints

- Reuse `financial_year_templates` and `tenant_financial_years`; do not create another calendar model.
- Derive tenant, actor, role, client, and invoice recipient from verified server-side context and stored records.
- Require `task.create` to create tasks and `task.approve` to make a final Tenant Admin decision.
- An invoice may be created only from a final-approved task's billing entry, and sending always targets the invoice's stored client.
- Keep the existing two-stage employee -> manager -> Tenant Admin approval workflow.
- Preserve tenant leading queries, transaction-local database context, RLS, and audit events.

---

### Task 1: Repair the task-billing lifecycle and add final Tenant Admin approval

**Files:**
- Create: `apps/backend/drizzle/migrations/0051_task_billable_entry_approval_lifecycle.sql`
- Modify: `apps/backend/src/platform/tenant-admin-tasks.dto.ts`
- Modify: `apps/backend/src/platform/tenant-admin-tasks.repository.ts`
- Modify: `apps/backend/src/platform/tenant-admin-tasks.service.ts`
- Modify: `apps/backend/src/platform/tenant-admin-tasks.controller.ts`
- Test: `apps/backend/test/unit/tenant-admin-tasks.test.ts`

**Interfaces:**
- Consumes: `POST /tenant-admin/tasks/:taskId/approval` with `{ decision: "approve" | "return", remarks?: string }`.
- Produces: a `TenantAdminTaskItemDto` whose status is `completed` after approval or `returned` after rework is requested.

- [x] **Step 1: Add the forward-only data repair migration**

```sql
update public.billable_task_entries bte
set status = 'pending_review',
    approved_by = null,
    approved_at = null,
    updated_at = now()
from public.tasks t
where t.tenant_id = bte.tenant_id
  and t.id = bte.task_id
  and bte.status = 'approved_for_invoice'
  and t.status <> 'completed';
```

- [x] **Step 2: Add a final-decision DTO and controller route**

```ts
export const decideTenantAdminTaskApprovalSchema = z.object({
  decision: z.enum(["approve", "return"]),
  remarks: z.string().trim().max(2000).optional().default(""),
});

@Post(":taskId/approval")
@RequirePermissions("task.approve")
decideTaskApproval(
  @CurrentRequestContext() context: RequestContext,
  @Param("taskId") taskId: string,
  @Body(new ZodValidationPipe(decideTenantAdminTaskApprovalSchema)) body: TenantAdminTaskApprovalRequest,
): Promise<TenantAdminTaskItemDto> {
  return this.service.decideTaskApproval(context, taskId, body);
}
```

- [x] **Step 3: Keep a new task's billable record pending**

```ts
// createPendingBillableEntry
status: "pending_review",
approvedBy: null,
approvedAt: null,
```

The SQL insert must use `status = 'pending_review'` with `approved_by` and `approved_at` set to `null`.

- [x] **Step 4: Make the final decision transactional and auditable**

```ts
const approved = input.decision === "approve";
await client.query(
  "update public.tasks set status = $3, billable_status = $4, actual_completed_at = case when $3 = 'completed' then coalesce(actual_completed_at, clock_timestamp()) else actual_completed_at end, updated_by = $5, updated_at = now() where tenant_id = $1 and id = $2",
  [tenantId, taskId, approved ? "completed" : "returned", approved ? "ready_for_billing" : "pending_completion", membershipId],
);
await client.query(
  "update public.billable_task_entries set status = $3, approved_by = case when $3 = 'approved_for_invoice' then $4 else null end, approved_at = case when $3 = 'approved_for_invoice' then clock_timestamp() else null end, updated_at = now() where tenant_id = $1 and task_id = $2 and status = 'pending_review'",
  [tenantId, taskId, approved ? "approved_for_invoice" : "pending_review", membershipId],
);
```

The method must lock the `tenant_approval` task and latest `manager_approved` submission, insert a `tenant_admin_approval` record, and write `TENANT_TASK_APPROVED` or `TENANT_TASK_RETURNED` audit events before returning the tenant-scoped task DTO.

- [x] **Step 5: Add tests for tenant scope and billing state**

```ts
expect(createBillingSql).toContain("'pending_review'");
expect(approvalSql).toContain("bte.tenant_id = $1");
expect(approvalSql).toContain("approved_for_invoice");
await expect(service.decideTaskApproval(platformContext, "task-1", { decision: "approve" })).rejects.toThrow();
```

- [x] **Step 6: Run the focused backend test**

Run: `corepack pnpm --dir apps/backend exec vitest run test/unit/tenant-admin-tasks.test.ts`

Expected: PASS.

### Task 2: Replace the mock Tenant Admin approval request with the backend contract

**Files:**
- Create: `src/app/api/tenant-admin/tasks/[taskId]/approval/route.ts`
- Modify: `src/features/operations/api/operations-api.ts`
- Modify: `src/components/operations/tasks-page.tsx`
- Test: `src/components/operations/tasks-page.test.tsx` if an existing task-page test harness is present.

**Interfaces:**
- Consumes: `POST /api/tenant-admin/tasks/:taskId/approval`.
- Produces: real `TenantAdminTask` data mapped by `mapTenantAdminTask` in the Tenant Admin task page.

- [x] **Step 1: Add the Next.js authenticated proxy route**

```ts
export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return proxyTenantAdminBackend({
    path: `/tenant-admin/tasks/${encodeURIComponent(taskId)}/approval`,
    init: { method: "POST", body: await request.text(), headers: { "content-type": request.headers.get("content-type") ?? "application/json" } },
    unavailableMessage: "Tenant approval could not be recorded.",
  });
}
```

- [x] **Step 2: Replace the in-memory `currentTasks()` approval mock**

```ts
export async function decideTenantTaskApproval(taskId: string, decision: "approve" | "return"): Promise<TenantAdminTask> {
  const response = await fetch(`/api/tenant-admin/tasks/${encodeURIComponent(taskId)}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  return tenantAdminTaskSchema.parse(await parseJsonResponse(response));
}
```

- [x] **Step 3: Map the server response to the current task view**

```ts
const approvedTask = await decideTenantTaskApproval(task.id, decision);
syncTask(mapTenantAdminTask(approvedTask));
```

- [x] **Step 4: Run frontend type checking**

Run: `corepack pnpm typecheck`

Expected: PASS.

### Task 3: Make the financial calendar and invoice client selection explicit in Tenant Admin UI

**Files:**
- Modify: `src/components/operations/tasks-page.tsx`
- Modify: `src/components/operations/finance-documents.tsx`

**Interfaces:**
- Consumes: existing `TenantAdminTaskOptions.countries` and `TenantBillableTaskEntry.clientId`.
- Produces: a country selector that shows its inherited financial year and a client selector that filters only ready task charges.

- [x] **Step 1: Keep the calendar field backed by the existing task options API**

```tsx
<Select value={input.countryCode} onChange={(event) => setInput((current) => ({ ...current, countryCode: event.target.value }))}>
  <option value="">Select country</option>
  {options.countries.map((country) => <option key={country.countryCode} value={country.countryCode}>{country.name}</option>)}
</Select>
<span>{selectedCountry ? `${selectedCountry.financialYearLabel}: ${selectedCountry.startsOn} to ${selectedCountry.endsOn}` : "Select a configured country calendar."}</span>
```

- [x] **Step 2: Explain the billing boundary inside the creation form**

```tsx
<p className="text-xs text-muted-foreground">
  The selected financial year is saved with this task. Its charge becomes available in Invoices after Tenant Admin approval.
</p>
```

- [x] **Step 3: Filter ready-to-invoice task charges by client**

```tsx
const clients = [...new Map(queue.data.map((entry) => [entry.clientId, { id: entry.clientId, name: entry.client }])).values()];
const entries = selectedClientId ? queue.data.filter((entry) => entry.clientId === selectedClientId) : queue.data;

<Select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
  <option value="">All clients</option>
  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
</Select>
```

The task-invoice dialog displays the stored client but does not allow it to be changed. `sendInvoice` continues to notify only the active client portal accounts joined by `invoices.client_id`.

- [x] **Step 4: Run focused frontend checks**

Run: `corepack pnpm typecheck`

Expected: PASS.

## Migration Safety Notes

- **Existing state:** new task charges are currently inserted as `approved_for_invoice` before work is completed.
- **Desired state:** created task charges remain `pending_review`; final Tenant approval promotes only that task's entry.
- **Compatibility:** the status values and columns already exist. The migration is data-only and forward compatible with both old and new application code.
- **Deployment order:** apply migration, then deploy backend, then frontend. New code remains safe if the migration has already run.
- **Rollback:** no data deletion occurs. If a forward fix is required, re-promote only entries belonging to explicitly completed tasks after an audit review.
- **Lock risk:** the update joins on the tenant/task keys and affects only currently ready entries for non-completed tasks; it is a short row update.
