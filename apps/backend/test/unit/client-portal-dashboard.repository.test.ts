import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("client dashboard queries use the authenticated account's business client scope", () => {
  const source = readFileSync(resolve(__dirname, "../../src/platform/client-portal-dashboard.repository.ts"), "utf8");

  expect(source).toContain("resolveClientPortalScope");
  expect(source).toContain("context.clientId");
  expect(source).toContain("rateAmount");
  expect(source).toContain("discountAmount");
  expect(source).toContain("bte.discount_amount");
  expect(source).toContain("as task_total");
  expect(source).toContain("as discount_total");
  expect(source).toContain("as amount_due");
  expect(source).toContain("as total_due");
  expect(source).toContain("rci.rate_amount");
  expect(source).toContain("coalesce(t.planned_due_at::date, t.created_at::date) between $3::date and $4::date");
  expect(source).toContain("as pending_tasks");
  expect(source).toContain("as completed_tasks");
  expect(source).toContain("t.status not in ('completed', 'cancelled')");
  expect(source).toContain("t.status = 'completed'");
  expect(source).toContain("ctr.status in ('submitted', 'under_review')");
  expect(source).toContain("e.start_date >= ctr.submitted_at::date");
  expect(source).toContain("csr.status = 'submitted'");
  expect(source).toContain("csr.submitted_at::date between $3::date and $4::date");
  expect(source).toContain("i.issued_on between $3::date and $4::date");
  expect(source).toContain("period.from");
  expect(source).toContain("period.to");
  expect(source).not.toContain("context.clientAccountId");
});
